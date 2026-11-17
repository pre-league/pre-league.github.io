import test from 'node:test';
import assert from 'node:assert/strict';
import { collectWeeklyRecords, combinedWeeklyRecords, documentedDivision, weeklyAwards, teamBenchPoints, leagueGameweek } from '../src/stats.mjs';

const team = (id, points, total, bench = [2, 3, 0, -1]) => ({ id, name: `Team ${id}`, manager: `Manager ${id}`, eventPoints: points, total, squadGameweek: 10, squad: bench.map((points, i) => ({ bench: true, slot: i + 12, points })) });
const sample = { divisions: {
  A: { gameweek: 10, source: 'api', updatedAt: '2026-11-17', teams: [team(1, 70, 500), team(2, 60, 600)] },
  D: { gameweek: 10, source: 'api', updatedAt: '2026-11-17', teams: [team(3, 70, 450, [10, 0, 2, 1])] }
} };

test('standings bench points preserve known totals and require four scored substitutes from the same week', () => {
  assert.equal(teamBenchPoints(team(1, 50, 500), 10), 4);
  assert.equal(teamBenchPoints(team(1, 50, 500, [0, 0, 0, 0]), 10), 0);
  assert.equal(teamBenchPoints(team(1, 50, 500, [-1, 0, 0, 0]), 10), -1);
  assert.equal(teamBenchPoints(team(1, 50, 500), 9), null);
  assert.equal(teamBenchPoints(team(1, 50, 500, [1, 2, 3]), 10), null);
  assert.equal(teamBenchPoints(team(1, 50, 500, [1, 2, 3, null]), 10), null);
  assert.equal(teamBenchPoints({ benchPoints: 13 }, 10), 13);
  assert.equal(teamBenchPoints({ benchPoints: 0 }, 10), 0);
  assert.equal(teamBenchPoints({}, 10), null);
});

test('weekly awards compare divisions, preserve ties and use team scores rather than player MVPs', () => {
  const awards = weeklyAwards(collectWeeklyRecords(sample), 10);
  assert.deepEqual(awards.mvp.winners.map(row => row.id), [1, 3]);
  assert.equal(awards.leader.winners[0].id, 2);
  assert.equal(awards.unlucky.winners[0].id, 3);
  assert.equal(awards.unlucky.value, 13);
  assert.deepEqual(awards.divisions, ['A', 'D']);
});

test('league gameweek history ranks cumulative totals, preserves ties and uses API scores before published scores', () => {
  const community = { currentSeason: '2026/27', weekly: {
    1: { D: { teams: [{ id: 3, name: 'Team 3', manager: 'Manager 3', totalPoints: 10, gameweekPoints: 10 }] } },
    9: { D: { source: 'documentation', sourceUrl: 'https://example.com/gw9', teams: [
      { id: 3, name: 'Team 3', manager: 'Manager 3', totalPoints: 400, gameweekPoints: 80, benchPoints: 0 },
      { id: 4, name: 'Team 4', manager: 'Manager 4', totalPoints: 410, gameweekPoints: 20, benchPoints: null },
      { id: 5, name: 'Team 5', manager: 'Manager 5', totalPoints: 410, gameweekPoints: 10, benchPoints: -1 }
    ] } },
    10: { D: { teams: [{ id: 3, totalPoints: 9999, gameweekPoints: 9999 }] } }
  } };
  const before = structuredClone({ sample, community });
  const latest = leagueGameweek(sample, community, 'D', '2026/27');
  assert.deepEqual(latest.weeks, [10, 9, 1]);
  assert.equal(latest.gameweek, 10);
  assert.equal(latest.league.teams[0].total, 450);
  assert.equal(latest.league.teams[0].eventPoints, 70);
  const past = leagueGameweek(sample, community, 'D', '2026/27', 9);
  assert.deepEqual(past.league.teams.map(row => [row.id, row.rank]), [[4, 1], [5, 1], [3, 3]]);
  assert.equal(past.league.teams.find(row => row.id === 3).benchPoints, 0);
  assert.equal(past.league.teams[0].benchPoints, null);
  assert.equal(past.league.teams[0].squad, null);
  assert.equal(past.league.sourceUrl, 'https://example.com/gw9');
  assert.equal(leagueGameweek(sample, community, 'D', '2026/27', 2).league, null);
  assert.equal(leagueGameweek(sample, community, 'D', '2026/27', 99).league, null);
  assert.equal(leagueGameweek(sample, community, 'D', '2026/27', NaN).league, null);
  assert.deepEqual(leagueGameweek({}, {}, 'B', '2026/27').weeks, []);
  assert.deepEqual({ sample, community }, before);
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

test('league History movement compares ranks with the previous gameweek, matching managers when published IDs are missing', () => {
  const community = { currentSeason: '2026/27', weekly: {
    1: { D: { teams: [{ id: null, manager: 'Fírst', name: 'Old name', totalPoints: 100 }, { id: 2, manager: 'Second', name: 'Second', totalPoints: 90 }, { id: 3, manager: 'Third', name: 'Third', totalPoints: 80 }] } },
    2: { D: { teams: [{ id: 1, manager: 'first', name: 'New name', totalPoints: 110 }, { id: 2, manager: 'Second', name: 'Second', totalPoints: 120 }, { id: 3, manager: 'Third', name: 'Second', totalPoints: 105 }] } },
    4: { D: { teams: [{ id: 1, manager: 'First', name: 'New name', totalPoints: 200 }] } }
  } };
  const week = leagueGameweek({}, community, 'D', '2026/27', 2);
  assert.deepEqual(week.league.teams.map(team => [team.manager, team.lastRank, team.rank]), [['Second', 2, 1], ['first', 1, 2], ['Third', 3, 3]]);
  assert.ok(leagueGameweek({}, community, 'D', '2026/27', 1).league.teams.every(team => team.lastRank === null));
  assert.equal(leagueGameweek({}, community, 'D', '2026/27', 4).league.teams[0].lastRank, null);
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
