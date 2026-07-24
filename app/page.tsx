"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type F1Data = {
  meta: { exportedAt?: string };
  pointsSystem: { racePoints: Record<string, number>; sprintPoints: Record<string, number> };
  teams: Array<{ id: string; name: string; shortName: string; color: string; color2: string; country: string; championships: number; engine: string; note: string }>;
  drivers: Array<{ id: string; name: string; team: string; country: string; championships: number; debut: number; helmet: string }>;
  tracks: Array<{ id: string; name: string; country: string; lengthKm: number; corners: number; chars: string }>;
  calendar: Array<{ round: number; name: string; country: string; track: string; date: string; sprint: boolean; status: string }>;
  raceResults: Record<string, {
    headline?: string;
    recap?: string;
    keyMoments?: Array<{ lap?: number | string; title?: string; label?: string; description?: string; text?: string }>;
    notablePerformances?: Array<string | { id?: string; driver?: string; reason?: string; note?: string }>;
    sourceUrl?: string;
    meta: { poleDriver?: string; fastestLap?: string; safetyCars?: number; weatherRace?: string; note?: string };
    results: Array<{ id: string; grid?: number | null; finish: number | string; pts: number; gap?: string; retirement?: string; note?: string }>;
    sprint?: { note?: string; results: Array<{ id: string; finish: number | string; pts: number }> } | null;
  }>;
  trackOutlinePaths: Record<string, string>;
};

type Standing = { id: string; points: number; wins: number; lastFive: number[] };
type Picks = { winner: string; surprise: string; team: string };

const AUSTIN_ROUND = 17;
const AUSTIN_DATE = new Date("2026-10-25T20:00:00Z");
const DATA_KEY = "f1-austin-data-v1";
const PICKS_KEY = "f1-austin-picks-v1";
const THEME_KEY = "f1-austin-theme";

const glossary = [
  ["Qualifying", "Saturday’s speed contest. Each driver’s best lap sets where they start on Sunday."],
  ["Constructor", "F1’s word for a team. Both of its drivers score toward the team championship."],
  ["DRS", "A movable rear-wing flap that reduces drag to help a following car attempt an overtake in designated zones."],
  ["Undercut", "Pitting before a rival to use fresh tires and gain time while they stay out."],
  ["Safety car", "A neutralized race period used when the track is unsafe. It closes the gaps between cars."],
  ["DNF", "Did not finish. The driver started the race but retired before the end."],
];

function driverName(data: F1Data, id?: string) {
  return data.drivers.find((d) => d.id === id)?.name || id || "Not available";
}

function teamForDriver(data: F1Data, id: string) {
  const driver = data.drivers.find((d) => d.id === id);
  return data.teams.find((t) => t.id === driver?.team);
}

function completedRounds(data: F1Data) {
  return Object.keys(data.raceResults).map(Number).sort((a, b) => a - b);
}

function driverStandings(data: F1Data, throughRound?: number): Standing[] {
  const table = new Map<string, Standing>(data.drivers.map((d) => [d.id, { id: d.id, points: 0, wins: 0, lastFive: [] }]));
  for (const round of completedRounds(data).filter((r) => throughRound === undefined || r <= throughRound)) {
    const race = data.raceResults[String(round)];
    for (const result of race.results || []) {
      const row = table.get(result.id);
      if (!row) continue;
      row.points += Number(result.pts) || 0;
      if (result.finish === 1) row.wins += 1;
      row.lastFive.push(Number(result.pts) || 0);
      row.lastFive = row.lastFive.slice(-5);
    }
    for (const result of race.sprint?.results || []) {
      const row = table.get(result.id);
      if (row) row.points += Number(result.pts) || 0;
    }
  }
  return [...table.values()].sort((a, b) => b.points - a.points || b.wins - a.wins);
}

function teamStandings(data: F1Data, drivers: Standing[]) {
  return data.teams.map((team) => {
    const ids = data.drivers.filter((d) => d.team === team.id).map((d) => d.id);
    return { ...team, points: drivers.filter((d) => ids.includes(d.id)).reduce((sum, d) => sum + d.points, 0) };
  }).sort((a, b) => b.points - a.points);
}

function teamRoundScores(data: F1Data, round: number) {
  const race = data.raceResults[String(round)];
  const scores = new Map(data.teams.map((team) => [team.id, 0]));
  for (const result of [...(race?.results || []), ...(race?.sprint?.results || [])]) {
    const team = data.drivers.find((driver) => driver.id === result.id)?.team;
    if (team) scores.set(team, (scores.get(team) || 0) + (Number(result.pts) || 0));
  }
  return scores;
}

function teamRecentScores(data: F1Data, teamId: string) {
  const driverIds = data.drivers.filter((driver) => driver.team === teamId).map((driver) => driver.id);
  return completedRounds(data).slice(-5).map((round) => {
    const race = data.raceResults[String(round)];
    return [...(race.results || []), ...(race.sprint?.results || [])]
      .filter((result) => driverIds.includes(result.id))
      .reduce((sum, result) => sum + (Number(result.pts) || 0), 0);
  });
}

function closePairs<T extends { points: number }>(rows: T[], limit = 4) {
  return rows.slice(0, -1).map((row, i) => ({ a: row, b: rows[i + 1], gap: row.points - rows[i + 1].points }))
    .sort((a, b) => a.gap - b.gap).slice(0, limit);
}

function parseMoment(moment: NonNullable<F1Data["raceResults"][string]["keyMoments"]>[number]) {
  return {
    lap: moment.lap ? `Lap ${moment.lap}` : "Race",
    title: moment.title || moment.label || "Key moment",
    text: moment.description || moment.text || (moment as { detail?: string }).detail || "",
  };
}

function ThemeButton({ theme, setTheme }: { theme: string; setTheme: (value: string) => void }) {
  return (
    <button className="theme-button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "◐"}</span>
      <span>{theme === "dark" ? "Light" : "Dark"}</span>
    </button>
  );
}

export default function Home() {
  const [data, setData] = useState<F1Data | null>(null);
  const [theme, setTheme] = useState("dark");
  const [active, setActive] = useState("road");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [showAllDrivers, setShowAllDrivers] = useState(false);
  const [gridView, setGridView] = useState<"drivers" | "teams">("drivers");
  const [dropState, setDropState] = useState("");
  const [picks, setPicks] = useState<Picks>({ winner: "", surprise: "", team: "" });
  const [now, setNow] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initialize = () => {
      setNow(Date.now());
      const storedTheme = localStorage.getItem(THEME_KEY);
      const initialTheme = storedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      setTheme(initialTheme);
      const storedPicks = localStorage.getItem(PICKS_KEY);
      if (storedPicks) setPicks(JSON.parse(storedPicks));
      const storedData = localStorage.getItem(DATA_KEY);
      if (storedData) {
        try { setData(JSON.parse(storedData)); return; } catch { localStorage.removeItem(DATA_KEY); }
      }
      fetch("/f1-2026-data.json").then((r) => r.json()).then(setData);
    };
    const frame = requestAnimationFrame(initialize);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks));
  }, [picks]);

  const standings = useMemo(() => data ? driverStandings(data) : [], [data]);
  const teams = useMemo(() => data ? teamStandings(data, standings) : [], [data, standings]);
  const rounds = useMemo(() => data ? completedRounds(data) : [], [data]);
  const latestRound = rounds.at(-1) || 0;
  const displayRound = selectedRound || latestRound;
  const race = data && latestRound ? data.raceResults[String(displayRound)] : null;
  const raceCalendar = data?.calendar.find((r) => r.round === displayRound);
  const raceTeamTable = useMemo(() => data ? teamStandings(data, driverStandings(data, displayRound)) : [], [data, displayRound]);
  const previousTeamTable = useMemo(() => data && displayRound > 1 ? teamStandings(data, driverStandings(data, displayRound - 1)) : [], [data, displayRound]);
  const weekendTeamScores = useMemo(() => data ? teamRoundScores(data, displayRound) : new Map<string, number>(), [data, displayRound]);
  const weekendTeamRanking = useMemo(() => [...raceTeamTable].sort((a, b) => (weekendTeamScores.get(b.id) || 0) - (weekendTeamScores.get(a.id) || 0)), [raceTeamTable, weekendTeamScores]);
  const austin = data?.calendar.find((r) => r.round === AUSTIN_ROUND);
  const cota = data?.tracks.find((t) => t.id === austin?.track);
  const days = now ? Math.max(0, Math.ceil((AUSTIN_DATE.getTime() - now) / 86400000)) : "—";
  const roundsToAustin = data ? data.calendar.filter((r) => r.round > latestRound && r.round < AUSTIN_ROUND && r.status !== "cancelled").length : 0;

  function savePicks(next: Partial<Picks>) {
    setPicks((current) => ({ ...current, ...next }));
  }

  function loadFile(file?: File) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed.calendar || !parsed.drivers || !parsed.raceResults) throw new Error("Missing season sections");
        setData(parsed);
        localStorage.setItem(DATA_KEY, JSON.stringify(parsed));
        setSelectedRound(null);
        setDropState(`Updated through round ${completedRounds(parsed).at(-1)}.`);
      } catch {
        setDropState("That file does not look like the expected F1 season JSON.");
      }
    };
    reader.readAsText(file);
  }

  if (!data) return <main className="loading">Preparing the grid…</main>;

  const driverBattles = closePairs(standings);
  const teamBattles = closePairs(teams);
  const visibleDrivers = showAllDrivers ? standings : standings.slice(0, 8);

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Road to Austin home">
          <span className="mark">17</span>
          <span>Road to Austin <small>F1 2026 family companion</small></span>
        </a>
        <nav aria-label="Main sections">
          {[
            ["road", "Road to Austin"],
            ["learn", "F1 in 90 sec"],
            ["grid", "Meet the grid"],
            ["austin", "Austin guide"],
            ["race", "Race day"],
          ].map(([id, label]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => { setActive(id); document.getElementById("content")?.scrollIntoView(); }}>{label}</button>
          ))}
        </nav>
        <ThemeButton theme={theme} setTheme={setTheme} />
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span>Round 17</span> Circuit of the Americas · Oct 23–25</p>
            <h1 id="hero-title">Every race brings<br />Austin <em>closer.</em></h1>
            <p className="hero-intro">Your family’s friendly guide to the stories, rivalries and tiny details that make Formula 1 thrilling—no prior knowledge required.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => { setActive("road"); document.getElementById("content")?.scrollIntoView(); }}>See what changed</button>
              <button className="secondary" onClick={() => { setActive("learn"); document.getElementById("content")?.scrollIntoView(); }}>Teach me F1</button>
            </div>
          </div>
          <div className="hero-stage" aria-label={`${days} days until the Austin Grand Prix`}>
            <div className="countdown"><strong>{days}</strong><span>days to race day</span></div>
            <div className="track-art" aria-hidden="true">
              <span className="track-label">COTA</span>
              <svg viewBox="0 0 200 120" role="img">
                <path d={data.trackOutlinePaths[cota?.id || "cota"]} />
              </svg>
            </div>
            <div className="stage-stats">
              <span><b>{roundsToAustin}</b> races before Austin</span>
              <span><b>{cota?.corners || 20}</b> corners</span>
              <span><b>{cota?.lengthKm || 5.513} km</b> a lap</span>
            </div>
          </div>
        </section>

        <section className="ticker" aria-label="Season snapshot">
          <span className="live-dot" aria-hidden="true"></span>
          <b>After round {latestRound}</b>
          <span>{driverName(data, standings[0]?.id)} leads on {standings[0]?.points} points</span>
          <span>{teams[0]?.shortName} leads the teams</span>
          <span>{driverBattles[0]?.gap} pts is the closest top-table driver gap</span>
        </section>

        <section id="content" className="content">
          {active === "road" && race && (
            <>
              <div className="section-heading">
                <div><p className="eyebrow">The family check-in</p><h2>What just happened?</h2></div>
                <label className="round-picker">Race
                  <select value={selectedRound || latestRound} onChange={(e) => setSelectedRound(Number(e.target.value))}>
                    {rounds.map((r) => <option key={r} value={r}>R{r} · {data.calendar.find((c) => c.round === r)?.name}</option>)}
                  </select>
                </label>
              </div>

              <article className="recap-card">
                <div className="recap-main">
                  <p className="race-loc">ROUND {selectedRound || latestRound} · {raceCalendar?.country}</p>
                  <h3>{race.headline || `${driverName(data, race.results.find((r) => r.finish === 1)?.id)} wins the ${raceCalendar?.name}`}</h3>
                  <p>{race.recap || race.meta.note || "The official classification is loaded; a written recap is not available for this round."}</p>
                  {!!race.notablePerformances?.length && <div className="notables" aria-label="Notable performances">
                    {race.notablePerformances.slice(0, 2).map((item, i) => {
                      const entry = typeof item === "string" ? { id: "", note: item } : item;
                      return <span key={i}><b>{entry.id || entry.driver}</b>{entry.reason || entry.note}</span>;
                    })}
                  </div>}
                  {race.sourceUrl && <a href={race.sourceUrl} target="_blank" rel="noreferrer">View official source ↗</a>}
                </div>
                <div className="podium" aria-label="Race podium">
                  {[2, 1, 3].map((position) => {
                    const result = race.results.find((r) => r.finish === position);
                    const team = result ? teamForDriver(data, result.id) : null;
                    return <div className={`podium-place p${position}`} key={position}>
                      <span className="podium-pos">P{position}</span>
                      <i style={{ background: team?.color }}></i>
                      <b>{result?.id}</b>
                      <small>{driverName(data, result?.id).split(" ").at(-1)}</small>
                      <strong>{result?.pts} pts</strong>
                    </div>;
                  })}
                </div>
              </article>

              <div className="split-grid">
                <article className="panel-card">
                  <div className="card-head"><div><p className="eyebrow">Replay in three beats</p><h3>Moments that shaped the race</h3></div><span className="number-badge">03</span></div>
                  <ol className="moments">
                    {(race.keyMoments || []).slice(0, 3).map((item, i) => {
                      const moment = parseMoment(item);
                      return <li key={i}><span>{moment.lap}</span><div><b>{moment.title}</b><p>{moment.text}</p></div></li>;
                    })}
                    {!race.keyMoments?.length && <li><span>Race</span><div><b>No moment log supplied</b><p>This round’s result remains included in all championship calculations.</p></div></li>}
                  </ol>
                </article>
                <article className="panel-card">
                  <div className="card-head"><div><p className="eyebrow">Numbers with meaning</p><h3>Race signals</h3></div></div>
                  <div className="signals">
                    <div><span>Winner</span><b>{driverName(data, race.results.find((r) => r.finish === 1)?.id)}</b><small>25 points for a Grand Prix win</small></div>
                    <div><span>Fastest lap</span><b>{driverName(data, race.meta.fastestLap)}</b><small>The quickest single lap in the race</small></div>
                    <div><span>Safety cars</span><b>{race.meta.safetyCars ?? "Not noted"}</b><small>Each can erase the gaps between cars</small></div>
                    <div><span>Race weather</span><b>{race.meta.weatherRace || "Not noted"}</b><small>Weather changes grip and strategy</small></div>
                  </div>
                </article>
              </div>

              <section className="battle-section">
                <div className="section-heading compact"><div><p className="eyebrow">Neutral watchlist</p><h2>The closest fights</h2><p>Small gaps mean one strong finish can change the order.</p></div></div>
                <div className="battle-columns">
                  <div className="battle-group"><h3>Drivers</h3>{driverBattles.map(({ a, b, gap }) =>
                    <div className="battle-row" key={`${a.id}-${b.id}`}>
                      <div><span style={{ background: teamForDriver(data, a.id)?.color }}></span><b>{a.id}</b><strong>{a.points}</strong></div>
                      <div className="gap-pill">{gap} pt{gap === 1 ? "" : "s"} apart</div>
                      <div><span style={{ background: teamForDriver(data, b.id)?.color }}></span><b>{b.id}</b><strong>{b.points}</strong></div>
                    </div>)}
                  </div>
                  <div className="battle-group"><h3>Teams</h3>{teamBattles.map(({ a, b, gap }) =>
                    <div className="battle-row" key={`${a.id}-${b.id}`}>
                      <div><span style={{ background: a.color }}></span><b>{a.shortName}</b><strong>{a.points}</strong></div>
                      <div className="gap-pill">{gap} pt{gap === 1 ? "" : "s"} apart</div>
                      <div><span style={{ background: b.color }}></span><b>{b.shortName}</b><strong>{b.points}</strong></div>
                    </div>)}
                  </div>
                </div>
              </section>

              <section className="team-story">
                <div className="section-heading compact"><div><p className="eyebrow">The other championship</p><h2>Two cars. One team score.</h2><p>Every driver result also builds the Constructors’ Championship—the contest for the best complete team and car.</p></div></div>
                <div className="team-weekend-grid">
                  <article className="team-weekend-winner" style={{ "--team": weekendTeamRanking[0]?.color } as React.CSSProperties}>
                    <p>Top-scoring team · Round {displayRound}</p>
                    <h3>{weekendTeamRanking[0]?.shortName}</h3>
                    <strong>{weekendTeamScores.get(weekendTeamRanking[0]?.id) || 0}<span>points together</span></strong>
                    <div>
                      {data.drivers.filter((driver) => driver.team === weekendTeamRanking[0]?.id).map((driver) => {
                        const scored = [...(race.results || []), ...(race.sprint?.results || [])].filter((result) => result.id === driver.id).reduce((sum, result) => sum + Number(result.pts || 0), 0);
                        return <span key={driver.id}><b>{driver.id}</b>{scored} pts</span>;
                      })}
                    </div>
                  </article>
                  <article className="constructor-table">
                    <div className="card-head"><div><p className="eyebrow">After this weekend</p><h3>Team championship</h3></div><span className="number-badge">11</span></div>
                    {raceTeamTable.slice(0, 6).map((team, index) => {
                      const previousIndex = previousTeamTable.findIndex((row) => row.id === team.id);
                      const change = previousIndex < 0 ? 0 : previousIndex - index;
                      return <div className="constructor-row" key={team.id}>
                        <span>{index + 1}</span><i style={{ background: team.color }}></i><b>{team.shortName}</b>
                        <small>{weekendTeamScores.get(team.id) || 0} this round</small>
                        <em>{change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : "—"}</em><strong>{team.points}</strong>
                      </div>;
                    })}
                  </article>
                  <article className="team-competition-note">
                    <p className="eyebrow">Why teams are different</p>
                    <h3>The car is part of the contest</h3>
                    <p>Teams choose their chassis concept, aerodynamics, suspension and how to package the power unit. Some build their own engine as a <b>works team</b>; others buy a <b>customer engine</b> and integrate it into a different car.</p>
                    <p>Both drivers share engineering data and help develop the same car—but each is also the clearest benchmark for the other. That creates cooperation and rivalry at the same time.</p>
                  </article>
                </div>
              </section>

              <section className="update-zone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); }}>
                <div><span className="update-icon">↻</span><div><h3>Next race, drop in the new story</h3><p>Drag your updated F1 JSON here. Standings, recaps and battles refresh immediately.</p></div></div>
                <button className="secondary" onClick={() => fileRef.current?.click()}>Choose JSON file</button>
                <input ref={fileRef} hidden type="file" accept=".json,application/json" onChange={(e) => loadFile(e.target.files?.[0])} />
                {dropState && <p className="update-status" role="status">{dropState}</p>}
              </section>
            </>
          )}

          {active === "learn" && (
            <>
              <div className="section-heading"><div><p className="eyebrow">F1 in 90 seconds</p><h2>Enough to enjoy the whole weekend</h2><p>You don’t need to memorize a rulebook. Start with the rhythm.</p></div></div>
              <section className="team-primer">
                <div><span>01</span><h3>Two championships</h3><p>Drivers chase an individual title. Teams add both drivers’ points together to chase the Constructors’ title.</p></div>
                <div><span>02</span><h3>Build, don’t just race</h3><p>Each team designs its car around technical choices. The engine may be built in-house or supplied by another manufacturer.</p></div>
                <div><span>03</span><h3>Partner and benchmark</h3><p>Teammates share data and setup work, then compete in equal machinery. Their comparison exposes performance.</p></div>
              </section>
              <div className="weekend-flow">
                {[
                  ["01", "Practice", "Learn the track", "Drivers test setups and tires. The lap times can mislead because teams run different fuel loads."],
                  ["02", "Qualifying", "Earn a starting spot", "Drivers chase one perfect lap. Fastest starts first; tiny mistakes can reshape Sunday."],
                  ["03", "Grand Prix", "Strategy meets speed", "Points go to the top 10. Watch the start, pit-stop timing, tire life and late-race pressure."],
                ].map(([n, title, sub, text]) => <article key={n}><span>{n}</span><p>{sub}</p><h3>{title}</h3><p>{text}</p></article>)}
              </div>
              <div className="numbers-primer">
                <div><strong>22</strong><span>drivers</span><p>Two per team, racing as rivals and teammates.</p></div>
                <div><strong>11</strong><span>teams</span><p>Each team builds its own car and scores both drivers’ points.</p></div>
                <div><strong>25</strong><span>points for a win</span><p>Then 18, 15, 12… down to one point for 10th.</p></div>
              </div>
              <section className="glossary">
                <div className="section-heading compact"><div><p className="eyebrow">Tap to learn</p><h2>Words you’ll hear</h2></div></div>
                <div className="glossary-grid">{glossary.map(([term, definition]) =>
                  <details key={term}><summary>{term}<span>+</span></summary><p>{definition}</p></details>)}
                </div>
              </section>
            </>
          )}

          {active === "grid" && (
            <>
              <div className="section-heading grid-heading"><div><p className="eyebrow">Meet the 2026 grid</p><h2>{gridView === "drivers" ? "The people in the cars" : "The teams behind both cars"}</h2><p>{gridView === "drivers" ? "Drivers compete across the grid and against the teammate with the same machinery." : "Team performance combines car design, engine partnership, operations and the points scored by both drivers."}</p></div>
                <div className="view-toggle" role="group" aria-label="Choose grid view">
                  <button className={gridView === "drivers" ? "on" : ""} onClick={() => setGridView("drivers")} aria-pressed={gridView === "drivers"}>Drivers</button>
                  <button className={gridView === "teams" ? "on" : ""} onClick={() => setGridView("teams")} aria-pressed={gridView === "teams"}>Teams</button>
                </div>
              </div>
              {gridView === "drivers" ? <><div className="driver-grid">
                {visibleDrivers.map((row, index) => {
                  const driver = data.drivers.find((d) => d.id === row.id)!;
                  const team = teamForDriver(data, row.id)!;
                  return <article className="driver-card" key={row.id} style={{ "--team": team.color } as React.CSSProperties}>
                    <div className="driver-rank">{String(index + 1).padStart(2, "0")}</div>
                    <div className="helmet-dot" title={driver.helmet}></div>
                    <p>{driver.country} · {team.shortName}</p>
                    <h3>{driver.name}</h3>
                    <div className="driver-score"><strong>{row.points}</strong><span>championship points</span></div>
                    <div className="form" aria-label={`Last five race scores: ${row.lastFive.join(", ")}`}>
                      {row.lastFive.map((pts, i) => <i key={i} style={{ height: `${Math.max(12, Math.min(100, pts * 4))}%` }}></i>)}
                    </div>
                    <small>{driver.championships ? `${driver.championships}× world champion` : `F1 debut: ${driver.debut}`}</small>
                  </article>;
                })}
              </div>
              <button className="secondary show-more" onClick={() => setShowAllDrivers(!showAllDrivers)}>{showAllDrivers ? "Show championship leaders" : "Show all 22 drivers"}</button></> :
              <div className="team-grid">
                {teams.map((team, index) => {
                  const teamDrivers = data.drivers.filter((driver) => driver.team === team.id);
                  const driverRows = teamDrivers.map((driver) => standings.find((row) => row.id === driver.id) || { id: driver.id, points: 0, wins: 0, lastFive: [] });
                  const maxContribution = Math.max(1, ...driverRows.map((row) => row.points));
                  const recentScores = teamRecentScores(data, team.id);
                  return <article className="team-card" key={team.id} style={{ "--team": team.color, "--team2": team.color2 } as React.CSSProperties}>
                    <div className="team-card-top"><span>P{index + 1}</span><p>{team.country}</p><strong>{team.points}</strong><small>team points</small></div>
                    <h3>{team.shortName}</h3>
                    <div className="engine-choice"><span>{team.engine.includes("(works") ? "Works power unit" : "Customer power unit"}</span><b>{team.engine}</b><p>{team.engine.includes("(works") ? "Designed by or exclusively partnered with this team." : "Supplied by another manufacturer, then packaged into this team’s own car."}</p></div>
                    <div className="teammate-duel"><p>Teammate scorecard</p>{driverRows.map((row) => <div key={row.id}><b>{row.id}</b><span><i style={{ width: `${Math.max(4, row.points / maxContribution * 100)}%` }}></i></span><strong>{row.points}</strong></div>)}</div>
                    <div className="team-form"><span>Last five team scores</span><div>{recentScores.map((score, i) => <i key={i} style={{ height: `${Math.max(10, Math.min(100, score * 2.2))}%` }} title={`${score} points`}></i>)}</div></div>
                    <p className="team-note">{team.note}</p>
                  </article>;
                })}
              </div>}
            </>
          )}

          {active === "austin" && (
            <>
              <div className="section-heading"><div><p className="eyebrow">Your October weekend</p><h2>Austin, decoded</h2><p>A practical preview built from the confirmed 2026 calendar and circuit data.</p></div></div>
              <div className="austin-grid">
                <article className="austin-track">
                  <div><span>UNITED STATES GRAND PRIX</span><h3>{cota?.name}</h3><p>{cota?.chars}</p></div>
                  <svg viewBox="0 0 200 120" role="img" aria-label="Circuit of the Americas track outline"><path d={data.trackOutlinePaths[cota?.id || "cota"]} /></svg>
                  <div className="track-numbers"><span><b>{cota?.lengthKm}</b> km</span><span><b>{cota?.corners}</b> corners</span><span><b>Oct 23–25</b> 2026</span></div>
                </article>
                <article className="look-for">
                  <p className="eyebrow">Look up from the timing screen</p><h3>Three things to watch</h3>
                  <ol>
                    <li><span>01</span><div><b>The climb into Turn 1</b><p>A dramatic first braking zone where the field compresses and different lines become possible.</p></div></li>
                    <li><span>02</span><div><b>The fast direction changes</b><p>Watch how confidently each car flows through a sequence rather than judging only straight-line speed.</p></div></li>
                    <li><span>03</span><div><b>The long-run tradeoff</b><p>A setup that is quick in one section may cost time elsewhere. F1 cars are always compromises.</p></div></li>
                  </ol>
                  <p className="fact-note">Austin session start times are not yet included in the supplied data. Add them only when confirmed.</p>
                </article>
              </div>
              <section className="picks">
                <div><p className="eyebrow">Make it personal</p><h2>Your Austin picks</h2><p>Neutral companion, personal predictions. Saved on this device.</p></div>
                <label>Race winner<select value={picks.winner} onChange={(e) => savePicks({ winner: e.target.value })}><option value="">Choose later</option>{standings.map((d) => <option value={d.id} key={d.id}>{driverName(data, d.id)}</option>)}</select></label>
                <label>Surprise result<select value={picks.surprise} onChange={(e) => savePicks({ surprise: e.target.value })}><option value="">Choose later</option>{standings.map((d) => <option value={d.id} key={d.id}>{driverName(data, d.id)}</option>)}</select></label>
                <label>Top team<select value={picks.team} onChange={(e) => savePicks({ team: e.target.value })}><option value="">Choose later</option>{teams.map((t) => <option value={t.id} key={t.id}>{t.shortName}</option>)}</select></label>
              </section>
            </>
          )}

          {active === "race" && (
            <>
              <div className="section-heading"><div><p className="eyebrow">One-handed cheat sheet</p><h2>Watch the race like a fan</h2><p>Five checkpoints to make sense of Sunday without live timing.</p></div></div>
              <div className="watch-list">
                {[
                  ["LIGHTS OUT", "The start", "Watch the run uphill into Turn 1. A driver can gain several places before the race settles."],
                  ["LAPS 1–5", "Find the rhythm", "Notice who is attacking and who is protecting tires. Early speed is not always sustainable."],
                  ["MIDDLE STINT", "Read the pit window", "If a rival pits, the next few laps matter. Fresh tires can create an undercut."],
                  ["ANY TIME", "Reset the board", "A safety car bunches the field. Leaders can lose an advantage; well-timed pit stops become cheaper."],
                  ["FINAL LAPS", "Watch the gaps", "A closing car may have fresher tires. Traffic and battery deployment can decide whether it gets a chance."],
                ].map(([time, title, text], i) => <article key={time}><span>{String(i + 1).padStart(2, "0")}</span><div><p>{time}</p><h3>{title}</h3><p>{text}</p></div></article>)}
              </div>
              <div className="saved-picks">
                <div><p className="eyebrow">Your call</p><h3>Austin prediction card</h3></div>
                <div><span>Winner</span><b>{picks.winner ? driverName(data, picks.winner) : "Choose in Austin guide"}</b></div>
                <div><span>Surprise</span><b>{picks.surprise ? driverName(data, picks.surprise) : "Choose in Austin guide"}</b></div>
                <div><span>Top team</span><b>{data.teams.find((t) => t.id === picks.team)?.shortName || "Choose in Austin guide"}</b></div>
              </div>
            </>
          )}
        </section>
      </main>

      <footer>
        <div><span className="mark">17</span><p>Built for a family learning F1 together on the road to Austin.</p></div>
        <p>Season data updated {data.meta.exportedAt ? new Date(data.meta.exportedAt).toLocaleDateString() : "from the supplied file"}. Missing facts stay missing—never guessed. <a href="/road-to-austin-presenter-guide.pdf" target="_blank" rel="noreferrer">Presenter guide ↗</a></p>
      </footer>
    </div>
  );
}
