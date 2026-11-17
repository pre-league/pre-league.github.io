import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { weeklyAwards } from '../src/stats.mjs';

const community = JSON.parse(await readFile(new URL('../data/community.json', import.meta.url), 'utf8'));

test('imported GW1 to GW10 scores cover all 19 teams and retain report sources', () => {
  for (let week = 1; week <= 10; week++) {
    const divisions = community.weekly[week];
    assert.deepEqual(Object.keys(divisions).sort(), ['A', 'B', 'C', 'D']);
    assert.equal(Object.values(divisions).flatMap(division => division.teams).length, 19);
    for (const [key, division] of Object.entries(divisions)) {
      assert.ok(division.sourceUrl.endsWith(`/${week}a-jornada`));
      for (const team of division.teams) {
        const previous = community.weekly[week - 1]?.[key].teams.find(row => row.manager === team.manager);
        assert.equal(team.totalPoints - (previous?.totalPoints ?? 0), team.gameweekPoints);
        assert.ok(team.benchPoints === null || Number.isSafeInteger(team.benchPoints));
      }
    }
    assert.ok(community.reports.some(report => report.gameweek === week && report.season === community.currentSeason));
  }
});

test('imported GW10 matches published awards and leaves unreported bench totals unknown', () => {
  const awards = weeklyAwards(community.weekly, 10);
  assert.equal(awards.mvp.value, 83);
  assert.equal(awards.mvp.winners[0].manager, 'Tiago Ferreira');
  assert.equal(awards.leader.value, 536);
  assert.equal(awards.leader.winners[0].name, 'Imperial FC');
  assert.equal(awards.unlucky.value, 25);
  assert.equal(awards.unlucky.winners[0].name, 'Jotinha FC');
  assert.equal(awards.unlucky.knownTeams, 1);
  assert.equal(community.weekly[10].B.teams[0].id, null);
});

test('2025/26 workbook import has three full final tables and 38 weeks whose sums match every final total', () => {
  const season = community.seasons.find(season => season.season === '2025/26');
  assert.deepEqual(Object.keys(season.leagues).sort(), ['1', '2', '3']);
  assert.deepEqual(Object.values(season.leagues).map(teams => teams.length), [5, 6, 5]);
  assert.equal(Object.keys(season.weekly).length, 38);
  for (const [key, teams] of Object.entries(season.leagues)) {
    assert.equal(teams[0].name, season.champions[key]);
    for (const team of teams) {
      const rows = Object.values(season.weekly).map(week => week[key].teams.find(row => row.name === team.name));
      assert.equal(rows.reduce((sum, row) => sum + row.gameweekPoints, 0), team.total);
      assert.ok(rows.every(row => row.id === null && row.benchPoints === null));
      assert.equal(rows.at(-1).totalPoints, team.total);
    }
  }
  assert.equal(weeklyAwards(season.weekly, 38).leader.value, 1931);
  assert.equal(weeklyAwards(season.weekly, 33).mvp.value, 114);
});
