import type { F1Data } from "./page";

type Standing = { id: string; points: number; wins: number; lastFive: number[] };

export function completedRounds(data: F1Data) {
  return data.calendar
    .filter((event) => event.round > 0 && event.status === "done"
      && data.raceResults[String(event.round)]?.results?.length > 0)
    .map((event) => event.round)
    .filter((round, index, rounds) => rounds.indexOf(round) === index)
    .sort((a, b) => a - b);
}

export function driverStandings(data: F1Data, throughRound?: number): Standing[] {
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

export function teamStandings(data: F1Data, throughRound?: number) {
  const points = new Map(data.teams.map((team) => [team.id, 0]));
  for (const round of completedRounds(data).filter((r) => throughRound === undefined || r <= throughRound)) {
    const race = data.raceResults[String(round)];
    for (const result of [...(race.results || []), ...(race.sprint?.results || [])]) {
      const team = result.team || data.drivers.find((driver) => driver.id === result.id)?.team;
      if (team) points.set(team, (points.get(team) || 0) + (Number(result.pts) || 0));
    }
  }
  return data.teams.map((team) => ({ ...team, points: points.get(team.id) || 0 })).sort((a, b) => b.points - a.points);
}

