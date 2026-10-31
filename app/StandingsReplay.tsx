"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { F1Data } from "./page";
import { completedRounds, driverStandings, teamStandings } from "./standings";

export default function StandingsReplay({ data, kind }: { data: F1Data; kind: "drivers" | "teams" }) {
  // Remount on imported data changes so a running replay cannot retain stale rounds.
  return <Replay key={JSON.stringify(data)} data={data} kind={kind} />;
}

function Replay({ data, kind }: { data: F1Data; kind: "drivers" | "teams" }) {
  const frames = useMemo(() => completedRounds(data).map((round) => ({
    round,
    name: data.calendar.find((event) => event.round === round)?.name || "Grand Prix",
    drivers: driverStandings(data, round),
    teams: teamStandings(data, round),
  })), [data]);
  const [index, setIndex] = useState(Math.max(0, frames.length - 1));
  const [playing, setPlaying] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const positions = useRef(new Map<string, number>());
  const isDrivers = kind === "drivers";
  const title = isDrivers ? "Drivers" : "Teams";
  const limit = isDrivers ? 10 : 8;
  const frame = frames[index];
  const rows = (isDrivers ? frame?.drivers : frame?.teams) || [];
  const previous = isDrivers ? frames[index - 1]?.drivers : frames[index - 1]?.teams;
  const visible = showAll ? rows : rows.slice(0, limit);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index >= frames.length - 1) setPlaying(false);
      else {
        setIndex(index + 1);
        if (index + 1 === frames.length - 1) setPlaying(false);
      }
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [playing, index, frames.length]);

  useEffect(() => {
    const next = new Map<string, number>();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listRef.current?.querySelectorAll<HTMLElement>("[data-standing-id]").forEach((element) => {
      const id = element.dataset.standingId!;
      const top = element.offsetTop;
      const before = positions.current.get(id);
      element.getAnimations().forEach((animation) => animation.cancel());
      if (!reduced && before !== undefined && before !== top) {
        element.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }],
          { duration: 600, easing: "ease-in-out" });
      }
      next.set(id, top);
    });
    positions.current = next;
  }, [index, showAll]);

  function step(next: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(frames.length - 1, next)));
  }

  return (
    <section className="standings-table" aria-labelledby={`${kind}-standings-title`}>
      <div className="standings-head"><div><p className="eyebrow">{isDrivers ? "World Championship" : "Constructors’ Championship"}</p><h3 id={`${kind}-standings-title`}>{title}</h3></div><span>{rows.length}</span></div>
      <div className="standings-replay" role="group" aria-label={`${title} championship replay`}>
        <p id={`${kind}-round`} aria-live="polite" aria-atomic="true">{frame ? `Round ${frame.round} · ${frame.name}${index === frames.length - 1 ? " · Latest completed race" : ""}` : "No completed races yet"}</p>
        <div className="replay-buttons">
          <button disabled={frames.length < 2} onClick={() => {
            if (!playing && index === frames.length - 1) setIndex(0);
            setPlaying(!playing);
          }} aria-pressed={playing}>{playing ? "Pause" : "Play"}</button>
          <button disabled={!frames.length} onClick={() => step(0)}>Restart</button>
          <button aria-label="Previous race" disabled={!frame || index === 0} onClick={() => step(index - 1)}>← Previous</button>
          <button aria-label="Next race" disabled={!frame || index === frames.length - 1} onClick={() => step(index + 1)}>Next →</button>
        </div>
        <label htmlFor={`${kind}-race-step`}>Race step {frame ? `${index + 1} of ${frames.length}` : "0 of 0"}</label>
        <input id={`${kind}-race-step`} type="range" min={0} max={Math.max(0, frames.length - 1)} value={index}
          disabled={frames.length < 2} aria-describedby={`${kind}-round`}
          aria-valuetext={frame ? `Round ${frame.round}, ${frame.name}` : "No completed races"}
          onChange={(event) => step(Number(event.target.value))} />
        <small>Cumulative points, including sprints. Arrows show rank change since the previous race.</small>
      </div>
      <div ref={listRef} className="replay-rows" role="list" aria-label={`${title} ranking after round ${frame?.round || 0}`}>
        {visible.map((row, rank) => {
          const driver = data.drivers.find((entry) => entry.id === row.id);
          const team = data.teams.find((entry) => entry.id === (isDrivers ? driver?.team : row.id));
          const name = isDrivers ? driver?.name || row.id : team?.shortName || row.id;
          const previousRank = previous?.findIndex((entry) => entry.id === row.id) ?? -1;
          const change = previousRank < 0 ? 0 : previousRank - rank;
          const gained = row.points - (previous?.find((entry) => entry.id === row.id)?.points || 0);
          const wins = "wins" in row ? row.wins : 0;
          return <div className={`standing-row ${isDrivers ? "" : "team-standing-row"}`} key={row.id} data-standing-id={row.id} role="listitem"
            aria-label={`Rank ${rank + 1}, ${name}, ${row.points} points, ${gained} this round`}>
            <span>{rank + 1}</span><i style={{ background: team?.color }} aria-hidden="true"></i>
            <div><b>{name}</b><small>{isDrivers ? `${team?.shortName} · ${wins} win${wins === 1 ? "" : "s"}` : team?.engine}</small>
              <span className="standing-points-bar" aria-hidden="true"><i style={{ width: `${rows[0]?.points ? row.points / rows[0].points * 100 : 0}%`, background: team?.color }} /></span>
            </div>
            <em className="standing-change" aria-label={change ? `${change > 0 ? "Up" : "Down"} ${Math.abs(change)} places` : "No rank change"}>{change > 0 ? `↑${change}` : change < 0 ? `↓${Math.abs(change)}` : "—"}</em>
            <em>+{gained} round</em>
            <span className="leader-gap">{rank === 0 ? "Leader" : `−${rows[0].points - row.points}`}</span>
            <strong>{row.points}<small>pts</small></strong>
          </div>;
        })}
      </div>
      <button className="standings-toggle" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? `Show top ${limit}` : `Show all ${rows.length} ${isDrivers ? "drivers" : "teams"}`}</button>
    </section>
  );
}
