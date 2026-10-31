import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../app/standings.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2017 } }).outputText;
const { completedRounds, driverStandings, teamStandings } = await import(
  "data:text/javascript;base64," + Buffer.from(compiled).toString("base64")
);
const data = JSON.parse(readFileSync(new URL("../public/f1-2026-data.json", import.meta.url)));

test("every replay frame matches cumulative published race and sprint points", () => {
  const driverTotals = new Map(data.drivers.map((driver) => [driver.id, 0]));
  const teamTotals = new Map(data.teams.map((team) => [team.id, 0]));
  for (const round of completedRounds(data)) {
    const race = data.raceResults[round];
    for (const result of [...race.results, ...(race.sprint?.results || [])]) {
      driverTotals.set(result.id, driverTotals.get(result.id) + Number(result.pts || 0));
      const team = result.team || data.drivers.find((driver) => driver.id === result.id).team;
      teamTotals.set(team, teamTotals.get(team) + Number(result.pts || 0));
    }
    const drivers = driverStandings(data, round);
    const teams = teamStandings(data, round);
    assert.equal(drivers.length, data.drivers.length);
    assert.equal(teams.length, data.teams.length);
    for (const driver of drivers) assert.equal(driver.points, driverTotals.get(driver.id), `Round ${round}, ${driver.id}`);
    for (const team of teams) assert.equal(team.points, teamTotals.get(team.id), `Round ${round}, ${team.id}`);
    assert.ok(drivers.every((row, i) => !i || drivers[i - 1].points >= row.points));
    assert.ok(teams.every((row, i) => !i || teams[i - 1].points >= row.points));
  }
  assert.deepEqual(driverStandings(data), driverStandings(data, completedRounds(data).at(-1)));
  assert.deepEqual(teamStandings(data), teamStandings(data, completedRounds(data).at(-1)));
});

test("future, cancelled, practice-only and sprint-only rounds cannot enter the replay or totals", () => {
  const fixture = structuredClone(data);
  const before = driverStandings(fixture);
  const rows = [{ id: data.drivers[0].id, finish: 1, pts: 999 }];
  fixture.calendar.push(
    { round: 80, status: "future" }, { round: 81, status: "done" },
    { round: 82, status: "done" }, { round: 83, status: "cancelled" }
  );
  fixture.raceResults[80] = { results: rows };
  fixture.raceResults[81] = { practice: rows };
  fixture.raceResults[82] = { results: [], sprint: { results: rows } };
  fixture.raceResults[83] = { results: rows };
  fixture.raceResults[84] = { results: rows };
  assert.deepEqual(completedRounds(fixture), completedRounds(data));
  assert.deepEqual(driverStandings(fixture), before);
});

test("empty and single-round seasons, gaps and existing win tie-break are supported", () => {
  const fixture = structuredClone(data);
  fixture.raceResults = {};
  assert.deepEqual(completedRounds(fixture), []);
  assert.ok(driverStandings(fixture).every((row) => row.points === 0));
  const [a, b] = fixture.drivers;
  fixture.raceResults[3] = { results: [{ id: a.id, finish: 2, pts: 18 }, { id: b.id, finish: 1, pts: 18 }] };
  assert.deepEqual(completedRounds(fixture), [3]);
  assert.equal(driverStandings(fixture)[0].id, b.id);
  assert.ok(driverStandings(fixture, 2).every((row) => row.points === 0));
});
