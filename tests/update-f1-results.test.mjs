import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveDriverId } from '../scripts/f1-driver-ids.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = JSON.parse(await fs.readFile(new URL('../public/f1-2026-data.json', import.meta.url)));
const fixture = JSON.parse(await fs.readFile(new URL('./fixtures/jolpica-2026-round19.json', import.meta.url)));
const hir = fixture.MRData.RaceTable.Races[0].Results.find(r => r.Driver.code === 'HIR').Driver;

test('HIR resolves only with validated source and canonical identities', () => {
  assert.equal(resolveDriverId(hir, data.drivers, 19), 'HIR');
  for (const patch of [{driverId: 'other'}, {code: 'OCO'}, {givenName: 'Other'}, {dateOfBirth: '2000-01-01'}]) {
    assert.throws(() => resolveDriverId({...hir, ...patch}, data.drivers, 19), /Conflicting identity/);
  }
  assert.throws(() => resolveDriverId(hir, data.drivers.filter(d => d.id !== 'HIR'), 19), /Unknown driver/);
  assert.throws(() => resolveDriverId({code: 'XYZ'}, data.drivers, 19), /Unknown driver/);
  assert.equal(resolveDriverId({code: 'VER'}, data.drivers, 19), 'VER');
});

async function runImporter(t, mutate = () => {}, prepare = () => {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'f1-import-'));
  t.after(() => fs.rm(dir, {recursive: true, force: true}));
  await fs.mkdir(path.join(dir, 'public'));
  const input = structuredClone(data);
  delete input.raceResults['19'];
  prepare(input);
  const payload = structuredClone(fixture);
  mutate(payload);
  const before = JSON.stringify(input);
  await fs.writeFile(path.join(dir, 'public/f1-2026-data.json'), before);
  await fs.writeFile(path.join(dir, 'source.json'), JSON.stringify(payload));
  await fs.writeFile(path.join(dir, 'mock.mjs'), `
    import fs from 'node:fs';
    const payload = JSON.parse(fs.readFileSync('source.json'));
    globalThis.fetch = async url => {
      if (!['https://api.jolpi.ca/ergast/f1/2026/results/1/?limit=100',
            'https://api.jolpi.ca/ergast/f1/2026/19/results/?limit=100'].includes(url)) throw new Error('Unexpected URL '+url);
      return {ok: true, json: async () => payload};
    };
  `);
  const result = spawnSync(process.execPath, ['--import', path.join(dir, 'mock.mjs'), path.join(root, 'scripts/update-f1-results.mjs')], {cwd: dir, encoding: 'utf8'});
  const after = await fs.readFile(path.join(dir, 'public/f1-2026-data.json'), 'utf8');
  return {result, before, after, input};
}

test('round 19 imports all 22 rows including Hirakawa without changing existing races', async t => {
  const {result, after, input} = await runImporter(t);
  assert.equal(result.status, 0, result.stderr);
  const updated = JSON.parse(after);
  const race = updated.raceResults['19'];
  assert.equal(race.results.length, 22);
  assert.equal(new Set(race.results.map(r => r.id)).size, 22);
  assert.deepEqual(race.results.find(r => r.id === 'HIR'), {id:'HIR',grid:18,finish:13,laps:71,gap:'+25.373',pts:0});
  assert.equal(race.meta.classificationStatus, 'provisional');
  delete updated.raceResults['19'];
  assert.deepEqual(updated, input);
});

for (const [name, change, error] of [
  ['unknown driver', rows => {rows[0].Driver.code = 'XYZ';}, /Unknown driver XYZ/],
  ['conflicting HIR identity', rows => {rows.find(r => r.Driver.code === 'HIR').Driver.driverId = 'other';}, /Conflicting identity/],
  ['duplicate driver', rows => {rows[0].Driver = structuredClone(rows[1].Driver);}, /Duplicate driver/]
]) {
  test(`${name} aborts without writing any data`, async t => {
    const {result, before, after} = await runImporter(t, payload => change(payload.MRData.RaceTable.Races[0].Results));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, error);
    assert.equal(after, before);
  });
}

test('existing final classification and editorial content are preserved', async t => {
  const existing = {meta: {classificationStatus: 'final'}, headline: 'Reviewed headline', recap: 'Reviewed recap', results: [{id: 'VER'}]};
  const {result, after, input} = await runImporter(t, () => {}, d => { d.raceResults['19'] = existing; });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(after), input);
});

test('provisional imports preserve authored editorial content and sprint', async t => {
  const existing = {meta: {classificationStatus: 'provisional', custom: 'keep'}, headline: 'Our headline', recap: 'Our recap', keyMoments: ['A moment'], notablePerformances: ['A performance'], sprint: {results: []}};
  const {result, after} = await runImporter(t, () => {}, d => { d.raceResults['19'] = existing; });
  assert.equal(result.status, 0, result.stderr);
  const race = JSON.parse(after).raceResults['19'];
  for (const key of ['headline', 'recap', 'keyMoments', 'notablePerformances', 'sprint']) assert.deepEqual(race[key], existing[key]);
  assert.equal(race.meta.custom, 'keep');
});
