import test from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { playerSeason, superstarRows, renderPlayers } from '../src/players.mjs';

test('a player who changes clubs credits each scoring XI, including repeat spells and bench weeks', () => {
  const weeks = {};
  for (const [i, [owner, score, multiplier]] of [[11, 5, 1], [22, 7, 0], [33, -1, 1], [11, 3, 0], [22, 10, 1]].entries()) {
    weeks[i + 1] = { points: { 4: score }, squads: { A: { [owner]: [[4, multiplier]] }, B: { 44: [[4, 1]] } } };
  }
  const { clubs, history } = playerSeason(weeks, 4, 'A', []);
  assert.deepEqual(clubs.map(row => [row.teamId, row.weeks, row.starts, row.points, row.average, row.bench]), [
    [22, 2, 1, 10, 10, 7], [11, 2, 1, 5, 5, 3], [33, 1, 1, -1, -1, 0]
  ]);
  assert.deepEqual(history.map(w => w.credited), [10, 0, -1, 0, 5]);
  delete weeks[5].points[4];
  assert.equal(playerSeason(weeks, 4, 'A', []).clubs.find(row => row.teamId === 22).average, null);
});

test('saved player allocations have eleven scoring positions per squad, including after automatic substitutions', async () => {
  const archive = JSON.parse(await readFile(new URL('../data/players.json', import.meta.url), 'utf8'));
  for (const week of Object.values(archive.weeks)) {
    for (const division of Object.values(week.squads)) {
      for (const picks of Object.values(division)) {
        assert.equal(picks.filter(([, used]) => used === 1).length, 11);
        assert.equal(picks.filter(([, used]) => used === 0).length, 4);
      }
    }
  }
});

test('Superstars ranks separate player-club spells league-wide and season rankings keep ties', () => {
  const teams = [{ id: 11, name: 'First' }, { id: 22, name: 'Second' }];
  const data = { players: { 1: { name: 'A', points: 20 }, 2: { name: 'B', points: 20 } }, weeks: {} };
  for (const [i, [owner, pts, used]] of [[11, 5, 1], [22, 8, 1], [11, 7, 0]].entries()) {
    data.weeks[i + 1] = { points: { 1: pts, 2: 2 }, squads: { C: { [owner]: [[1, used], [2, 1]] } } };
  }
  data.players[3] = { name: 'Bench only', points: 0 };
  data.weeks[1].squads.C[11].push([3, 0]);
  data.weeks[1].points[3] = 100;
  const rows = superstarRows(data, 'C', teams);
  assert.ok(!rows.some(row => row.id === 3));
  assert.equal(playerSeason(data.weeks, 3, 'C', teams).clubs[0].average, null);
  const star = rows.find(row => row.id === 1 && row.teamId === 11);
  assert.equal(rows.find(row => row.id === 1 && row.teamId === 22).points, 8);
  const board = renderPlayers(data, { divisions: { C: { teams } } }, { divisions: [{ key: 'C' }] }, new URLSearchParams('section=superstars&metric=bench&team=11'), 'C', () => '');
  assert.match(board.html, /<th scope="col">Club<\/th>/);
  assert.ok(board.html.includes('First') && board.html.includes('Second'));
  assert.doesNotMatch(board.html, /superstar-team|Bench only|value="bench"/);
  assert.deepEqual([star.weeks, star.starts, star.points, star.average, star.peak, star.bench], [2, 1, 5, 5, 5, 7]);
  data.weeks[1].squads.D = { 11: [[1, 1]] };
  const divisions = { C: { teams }, D: { teams: [{ id: 11, name: 'Other league club' }] } };
  const renderTab = query => renderPlayers(data, { divisions }, { divisions: [{ key: 'C' }, { key: 'D' }] }, new URLSearchParams(query), 'C', () => '').html;
  const firstTab = renderTab('');
  assert.match(firstTab, /value="all" selected>All leagues/);
  assert.match(firstTab, /Other league club/);
  assert.match(firstTab, /First/);
  assert.doesNotMatch(renderTab('league=C'), /Other league club/);
  assert.match(firstTab, /aria-current="page">Superstars<\/a><a [^>]*>Season stats<\/a>/);
  assert.match(firstTab, /value="average" selected>Weekly average/);
  const html = renderTab('section=season');
  assert.equal((html.match(/<tr><td>1<\/td>/g) ?? []).length, 2);
});
