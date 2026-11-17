import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeLeague, normalizeSquad, normalizeTransactions, escapeHtml } from '../src/model.mjs';

const sample = JSON.parse(await readFile(new URL('../data/league-d.json', import.meta.url)));

test('joins standings through league-entry IDs, retains distinct public entry IDs', () => {
  const league = normalizeLeague(sample, 10219);
  assert.deepEqual(league.teams.map(t => [t.id, t.name, t.total]), [
    [130177, 'Imperial FC', 536], [131691, 'Boomxhakalaka', 442],
    [50027, 'Grannies FC', 441], [50751, 'SportingCadafais', 429]
  ]);
  assert.equal(league.teams[2].eventPoints, 62);
});

test('rejects mismatched leagues, orphan standings, duplicates and invalid scores', () => {
  assert.throws(() => normalizeLeague(sample, 999));
  for (const mutate of [
    d => d.standings[0].league_entry = 999,
    d => d.league_entries.push(d.league_entries[0]),
    d => d.standings[0].total = '536',
    d => d.standings.push(d.standings[0])
  ]) {
    const data = structuredClone(sample); mutate(data);
    assert.throws(() => normalizeLeague(data, 10219));
  }
});

test('missing player scores remain unknown; zero and negative scores are retained', () => {
  const picks = { picks: [
    { element: 1, position: 1 }, { element: 2, position: 2 }, { element: 3, position: 12 }
  ] };
  const bootstrap = { elements: [1, 2, 3].map(id => ({ id, web_name: `Player ${id}`, element_type: 2, team: 1 })), teams: [{ id: 1, short_name: 'ARS' }] };
  const squad = normalizeSquad(picks, bootstrap, { elements: { 1: { stats: { total_points: 0 } }, 2: { stats: { total_points: -1 } } } });
  assert.deepEqual(squad.map(p => p.points), [0, -1, null]);
  assert.equal(squad[2].bench, true);
  assert.throws(() => normalizeSquad({ picks: [{ element: 999, position: 1 }] }, bootstrap, {}));
});

test('keeps only completed public transactions and resolves owner using entry ID', () => {
  const league = normalizeLeague(sample, 10219);
  const rows = normalizeTransactions({ transactions: [
    { id: 1, entry: 50027, element_in: 2, element_out: 3, event: 10, kind: 'w', result: 'a' },
    { id: 2, entry: 50027, element_in: 3, element_out: 2, event: 11, kind: 'w', result: 'r' }
  ] }, league.teams, { elements: [{ id: 2, web_name: 'Incoming' }, { id: 3, web_name: 'Outgoing' }] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].teamId, 50027);
  assert.equal(rows[0].playerIn, 'Incoming');
});

test('API names are escaped before HTML rendering', () => {
  assert.equal(escapeHtml('<img src=x onerror="bad()"> &'), '&lt;img src=x onerror=&quot;bad()&quot;&gt; &amp;');
});

test('player headshots use the official photo code, never the season-specific FPL ID', () => {
  const catalog = { elements: [{ id: 7, code: 118748, web_name: 'Salah', element_type: 3, team: 1 }] };
  const picks = { picks: [{ element: 7, position: 1 }] };
  assert.equal(normalizeSquad(picks, catalog, {})[0].photoCode, 118748);
  for (const code of [null, -1, '118748', '1" onerror="bad()', 0]) {
    catalog.elements[0].code = code;
    assert.equal(normalizeSquad(picks, catalog, {})[0].photoCode, null);
  }
});
