import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLeague } from '../src/model.mjs';
import { refreshData } from '../scripts/refresh.mjs';

const sample = JSON.parse(await readFile(new URL('../data/league-d.json', import.meta.url)));
const config = { season: '2026/27', divisions: [{ key: 'A', leagueId: 3887 }, { key: 'D', leagueId: 10219 }] };
const now = '2026-11-17T06:17:00.000Z';
const previous = { divisions: { D: { ...normalizeLeague(sample, 10219), updatedAt: null, source: 'provided' } }, history: [] };

test('upstream failure retains the last valid division and never invents a refresh time', async () => {
  const result = await refreshData(config, previous, async () => { throw new Error('Offline'); }, now);
  assert.equal(result.divisions.D.teams[0].total, 536);
  assert.equal(result.divisions.D.updatedAt, null);
  assert.equal(result.divisions.D.stale, true);
  assert.equal(result.divisions.A, undefined);
  assert.equal(result.errors.length, 2);
});

test('standings refresh independently of unavailable player and transaction endpoints', async () => {
  const result = await refreshData(config, previous, async path => {
    if (path === 'league/10219/details') return sample;
    throw new Error('Unavailable');
  }, now);
  assert.equal(result.divisions.D.updatedAt, now);
  assert.equal(result.divisions.D.source, 'api');
  assert.equal(result.divisions.D.teams[0].squad, null);
  assert.equal(result.divisions.D.transactions, null);
  assert.ok(result.divisions.D.warnings.length > 0);
});

test('successful refresh enriches squads using the Draft gameweek and entry IDs', async () => {
  const paths = [];
  const result = await refreshData({ ...config, divisions: [config.divisions[1]] }, previous, async path => {
    paths.push(path);
    if (path === 'game') return { current_event: 10 };
    if (path === 'bootstrap-static') return { elements: [{ id: 7, web_name: 'A player', element_type: 1, team: 1 }], teams: [{ id: 1, short_name: 'ARS' }] };
    if (path === 'event/10/live') return { elements: { 7: { stats: { total_points: 6 } } } };
    if (path === 'league/10219/details') return sample;
    if (path.endsWith('/transactions')) return { transactions: [] };
    if (/^entry\/\d+\/event\/10$/.test(path)) return { picks: [{ element: 7, position: 1 }] };
    throw new Error(`Unexpected path ${path}`);
  }, now);
  assert.ok(paths.includes('entry/50027/event/10'));
  assert.ok(!paths.includes('entry/50100/event/10'));
  assert.equal(result.divisions.D.teams[0].squad[0].points, 6);
  assert.equal(result.divisions.D.teams[0].squadGameweek, 10);
  assert.deepEqual(result.divisions.D.transactions, []);
  assert.deepEqual(result.errors, []);
});

test('rejects nonnumeric configured IDs before forming endpoint URLs', async () => {
  await assert.rejects(() => refreshData({ divisions: [{ key: 'D', leagueId: '../secrets' }] }, previous, async () => ({}), now));
});
