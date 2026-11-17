import test from 'node:test';
import assert from 'node:assert/strict';
import { collectWeeklyRecords, combinedWeeklyRecords, documentedDivision, weeklyAwards } from '../src/stats.mjs';

const team = (id, points, total, bench = [2, 3, 0, -1]) => ({ id, name: `Team ${id}`, manager: `Manager ${id}`, eventPoints: points, total, squadGameweek: 10, squad: bench.map((points, i) => ({ bench: true, slot: i + 12, points })) });
const sample = { divisions: {
  A: { gameweek: 10, source: 'api', updatedAt: '2026-11-17', teams: [team(1, 70, 500), team(2, 60, 600)] },
  D: { gameweek: 10, source: 'api', updatedAt: '2026-11-17', teams: [team(3, 70, 450, [10, 0, 2, 1])] }
} };

test('weekly awards compare divisions, preserve ties and use team scores rather than player MVPs', () => {
  const awards = weeklyAwards(collectWeeklyRecords(sample), 10);
  assert.deepEqual(awards.mvp.winners.map(row => row.id), [1, 3]);
  assert.equal(awards.leader.winners[0].id, 2);
  assert.equal(awards.unlucky.winners[0].id, 3);
  assert.equal(awards.unlucky.value, 13);
  assert.deepEqual(awards.divisions, ['A', 'D']);
});

test('missing bench scores remain unknown; scores from different weeks never mix', () => {
  const data = structuredClone(sample);
  data.divisions.D.gameweek = 9;
  data.divisions.A.teams[0].squad[0].points = null;
  const awards = weeklyAwards(collectWeeklyRecords(data), 10);
  assert.deepEqual(awards.divisions, ['A']);
  assert.equal(awards.unlucky.knownTeams, 1);
  assert.equal(awards.unlucky.winners[0].id, 2);
});

test('daily updates preserve earlier weeks and stale divisions do not overwrite verified records', () => {
  const weekly = collectWeeklyRecords(sample);
  const data = structuredClone(sample);
  data.weekly = weekly;
  data.divisions.A.gameweek = 11;
  data.divisions.D.stale = true;
  data.divisions.D.teams[0].total = 9999;
  const updated = collectWeeklyRecords(data);
  assert.equal(updated[10].D.teams[0].totalPoints, 450);
  assert.ok(updated[11].A);
  assert.equal(weekly[11], undefined);
  assert.equal(weeklyAwards(updated, 38).mvp.value, null);
});

test('published weeks fill missing divisions while API scores take priority within the same season', () => {
  const community = { currentSeason: '2026/27', weekly: { 10: {
    A: { source: 'documentation', teams: [{ id: 1, totalPoints: 999 }] },
    B: { source: 'documentation', teams: [{ id: null, manager: 'Coach', gameweekPoints: 83, totalPoints: 488 }] }
  } } };
  const before = structuredClone(community);
  const weekly = combinedWeeklyRecords(sample, community, '2026/27');
  assert.equal(weekly[10].A.teams[0].totalPoints, 500);
  assert.equal(weeklyAwards(weekly, 10).mvp.value, 83);
  assert.deepEqual(community, before);
  assert.equal(combinedWeeklyRecords(sample, community, '2027/28')[10].B, undefined);
});

test('documented division uses the latest report, ranks totals and keeps unknown team IDs unavailable', () => {
  const community = { currentSeason: '2026/27', weekly: { 9: { B: { teams: [] } }, 10: { B: {
    sourceUrl: 'https://sites.google.com/view/prefantasydraft/jornal/10a-jornada',
    teams: [{ id: null, name: 'Second', manager: 'Coach', totalPoints: 440, gameweekPoints: 30 }, { id: null, name: 'Leader', manager: 'Coach 2', totalPoints: 488, gameweekPoints: 83 }]
  } } } };
  const division = documentedDivision(community, 'B', '2026/27');
  assert.equal(division.source, 'documentation');
  assert.equal(division.gameweek, 10);
  assert.equal(division.teams[0].name, 'Leader');
  assert.equal(division.teams[0].rank, 1);
  assert.equal(division.teams[0].id, null);
  assert.equal(division.transactions, null);
  assert.equal(documentedDivision(community, 'B', '2027/28'), null);
});
