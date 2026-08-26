"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { F1Data } from "./page";

type Race = F1Data["calendar"][number];
type Prediction = { userId: string; raceRound: number; p1: string | null; p2: string | null; p3: string | null; team: string | null; pole: string | null; fastestLap: string | null };
type Member = { userId: string; nickname: string };
type State = { signedIn: boolean; user?: { id: string; displayName: string }; profile?: { nickname: string; groupId: string | null }; group?: { name: string; inviteCode: string }; members?: Member[]; predictions?: Prediction[] };

function scorePick(data: F1Data, pick: Prediction) {
  const result = data.raceResults[String(pick.raceRound)];
  if (!result) return 0;
  const podium = [1, 2, 3].map((place) => result.results.find((row) => row.finish === place)?.id);
  const choices = [pick.p1, pick.p2, pick.p3];
  let score = choices.reduce((sum, driver, index) => sum + (!driver ? 0 : podium[index] === driver ? 10 : podium.includes(driver) ? 5 : 0), 0);
  if (choices.every((driver, index) => driver && podium[index] === driver)) score += 10;
  const winner = result.results.find((row) => row.finish === 1);
  const winnerTeam = winner?.team || data.drivers.find((driver) => driver.id === winner?.id)?.team;
  if (pick.team && pick.team === winnerTeam) score += 8;
  if (pick.pole && pick.pole === result.meta.poleDriver) score += 6;
  if (pick.fastestLap && pick.fastestLap === result.meta.fastestLap) score += 4;
  return score;
}

export default function FamilyChallenge({ data, nextRace }: { data: F1Data; nextRace?: Race }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState("");
  const [groupName, setGroupName] = useState("Our F1 Family");
  const [inviteCode, setInviteCode] = useState("");
  const [pick, setPick] = useState({ p1: "", p2: "", p3: "", team: "", pole: "", fastestLap: "" });
  const load = useCallback(() => fetch("/api/challenge").then(async (response) => ({ response, body: await response.json() })).then(({ response, body }) => {
    if (response.status === 401) setState({ signedIn: false });
    else if (!response.ok) setError(body.error || "The challenge could not load.");
    else {
      setState(body);
      const saved = nextRace && body.predictions?.find((entry: Prediction) => entry.userId === body.user?.id && entry.raceRound === nextRace.round);
      if (saved) setPick({ p1: saved.p1 || "", p2: saved.p2 || "", p3: saved.p3 || "", team: saved.team || "", pole: saved.pole || "", fastestLap: saved.fastestLap || "" });
    }
  }).catch(() => setError("The challenge could not load.")), [nextRace]);
  useEffect(() => { load(); }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/challenge", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "That did not save.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "That did not save."); }
    finally { setBusy(false); }
  };

  const leaderboard = useMemo(() => (state?.members || []).map((member) => ({ ...member, points: (state?.predictions || []).filter((entry) => entry.userId === member.userId).reduce((sum, entry) => sum + scorePick(data, entry), 0) })).sort((a, b) => b.points - a.points), [state, data]);
  const myPastPicks = (state?.predictions || []).filter((entry) => entry.userId === state?.user?.id && data.raceResults[String(entry.raceRound)]);
  const savedCount = (state?.predictions || []).filter((entry) => entry.userId === state?.user?.id).length;
  const level = !pick.p1 ? 1 : !(pick.p2 && pick.p3) ? 2 : !pick.team ? 3 : 4;

  return <div className="challenge-page">
    <section className="challenge-hero">
      <div><p className="eyebrow">A game for the whole family</p><h2>Pick. Watch. Brag.</h2><p>Make predictions before each race, learn one new layer at a time and see who reads the season best.</p></div>
      <div className="challenge-badge"><b>{nextRace ? `R${nextRace.round}` : "2026"}</b><span>{nextRace?.name || "Family Challenge"}</span></div>
    </section>
    {error && <p className="challenge-error" role="alert">{error}</p>}
    {state === null && <p className="challenge-loading">Loading your family grid…</p>}
    {state !== null && (!state.signedIn || !state.profile?.groupId) && <>
      <section className="challenge-signin"><p className="eyebrow">No account required</p><h3>Choose a family nickname</h3><p>Create a family grid or join one with its private code. This browser will remember your player.</p></section>
      <section className="challenge-onboard">
      <div><p className="eyebrow">Start a league</p><h3>Create your family</h3><label>Your nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="e.g. Pit Lane Nana" /></label><label>Family name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label><button disabled={busy} onClick={() => post({ action: "create_group", name: groupName, nickname })}>Create family</button></div>
      <div><p className="eyebrow">Have a code?</p><h3>Join your family</h3><label>Your nickname<input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="e.g. Turn One Tom" /></label><label>Six-character family code<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} /></label><button disabled={busy || !inviteCode} onClick={() => post({ action: "join_group", inviteCode, nickname })}>Join family</button></div>
      </section>
    </>}
    {state?.signedIn && state.profile?.groupId && <>
      <section className="family-bar"><div><p className="eyebrow">Your grid</p><h3>{state.group?.name}</h3></div><div><span>Invite family with code</span><strong>{state.group?.inviteCode}</strong></div><button className="challenge-signout" onClick={() => post({ action: "sign_out" })}>Leave this player</button></section>
      <div className="challenge-grid">
        <section className="prediction-card"><p className="eyebrow">Level {level} of 4 · {savedCount ? "Welcome back" : "Rookie"}</p><h3>{nextRace ? `Pick the ${nextRace.name}` : "Next picks open soon"}</h3><p className="challenge-help">Start with a winner. Each choice introduces another part of an F1 weekend.</p>
          {nextRace && <div className="prediction-fields">
            <label>Race winner<select value={pick.p1} onChange={(e) => setPick({ ...pick, p1: e.target.value })}><option value="">Choose a driver</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
            {pick.p1 && <><label>Second place<select value={pick.p2} onChange={(e) => setPick({ ...pick, p2: e.target.value })}><option value="">Choose</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><label>Third place<select value={pick.p3} onChange={(e) => setPick({ ...pick, p3: e.target.value })}><option value="">Choose</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label></>}
            {pick.p2 && pick.p3 && <label>Winning constructor<select value={pick.team} onChange={(e) => setPick({ ...pick, team: e.target.value })}><option value="">Choose a team</option>{data.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>}
            {pick.team && <><label>Pole position<select value={pick.pole} onChange={(e) => setPick({ ...pick, pole: e.target.value })}><option value="">Optional</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label><label>Fastest race lap<select value={pick.fastestLap} onChange={(e) => setPick({ ...pick, fastestLap: e.target.value })}><option value="">Optional</option>{data.drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label></>}
            <button disabled={busy || !pick.p1} onClick={() => post({ action: "save_prediction", raceRound: nextRace.round, ...pick })}>{busy ? "Saving…" : "Lock in my picks"}</button>
          </div>}
        </section>
        <aside className="leaderboard-card"><p className="eyebrow">Family leaderboard</p><h3>Bragging rights</h3>{leaderboard.map((member, index) => <div className="leader-row" key={member.userId}><span>{index + 1}</span><b>{member.nickname}</b><strong>{member.points} pts</strong></div>)}{!leaderboard.length && <p>Scores appear after the first completed race.</p>}</aside>
      </div>
      <section className="challenge-rules"><div><p className="eyebrow">How scoring works</p><h3>Simple enough to learn as you go</h3></div><span><b>10</b> exact podium place</span><span><b>5</b> podium, wrong place</span><span><b>8</b> winning team</span><span><b>6</b> pole</span><span><b>4</b> fastest lap</span><span><b>+10</b> perfect podium</span></section>
      {!!myPastPicks.length && <section className="challenge-history"><p className="eyebrow">Your season</p><h3>Race-by-race scores</h3>{myPastPicks.map((entry) => <div key={entry.raceRound}><span>Round {entry.raceRound} · {data.calendar.find((race) => race.round === entry.raceRound)?.name}</span><b>{scorePick(data, entry)} points</b></div>)}</section>}
    </>}
  </div>;
}
