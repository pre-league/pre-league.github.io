import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { clubForTeam, clubBrandTeam, clubRoute, getClubSeason, getHistoricalLeague, renderClubSeason, renderHistoricalLeague } from '../src/clubs.mjs';
import { documentedDivision } from '../src/stats.mjs';

const community = JSON.parse(await readFile(new URL('../data/community.json', import.meta.url), 'utf8'));
const latest = JSON.parse(await readFile(new URL('../data/latest.json', import.meta.url), 'utf8'));
const current = { ...latest, divisions: Object.fromEntries(['A', 'B', 'C', 'D'].map(key => [key, latest.divisions[key] ?? documentedDivision(community, key, '2026/27')])) };

test('confirmed identities connect the same club across renamed teams and different competitions', () => {
  const pigui = clubForTeam(community, { name: 'Pigui' }, '2025/26');
  assert.equal(pigui.manager, 'Miguel Fernandes');
  assert.equal(clubForTeam(community, { manager: 'Miguel Fernandes', id: 999999 }, '2026/27'), pigui);
  const past = getClubSeason(community, current, pigui, '2025/26');
  assert.equal(past.league.name, 'League 1');
  assert.equal(past.team.name, 'Pigui');
  assert.equal(past.team.total, 1881);
  assert.equal(past.team.rank, 1);
  assert.equal(past.team.id, null);
  assert.equal(past.weeks.length, 38);
  assert.equal(past.brandTeam.id, 15016);
  const present = getClubSeason(community, current, pigui, '2026/27');
  assert.equal(present.team.name, 'Pigui FC');
  assert.equal(present.key, 'A');
  assert.equal(getClubSeason(community, current, pigui, '2000/01'), null);
});

test('clubs with missing API IDs have profiles; unmatched past clubs never acquire a guessed current owner', () => {
  const james = clubForTeam(community, { name: 'James' }, '2025/26');
  assert.equal(james.manager, 'Tiago Ferreira');
  assert.equal(getClubSeason(community, current, james, '2026/27').team.name, 'Chelas City');
  const dt = clubForTeam(community, { name: 'DT' }, '2025/26');
  assert.equal(getClubSeason(community, current, dt, '2026/27'), null);
  assert.equal(getClubSeason(community, current, dt, '2025/26').team.total, 1615);
  const newcomer = clubForTeam(community, { manager: 'Filipe Pregal' }, '2026/27');
  assert.equal(getClubSeason(community, current, newcomer, '2025/26'), null);
});

test('API manager capitalization and accent differences retain confirmed club identities and both seasons', () => {
  const snapshot = structuredClone(current);
  snapshot.divisions.C.teams.find(team => team.name === 'Fredddd').manager = 'frederico belchior';
  snapshot.divisions.C.teams.find(team => team.name === 'Jotinha FC').manager = 'Joao Martins';
  for (const [manager, key] of [['frederico belchior', 'frederico-belchior'], ['Joao Martins', 'joao-martins']]) {
    const club = clubForTeam(community, { manager }, '2026/27');
    assert.equal(club?.key, key);
    const view = getClubSeason(community, snapshot, club, '2026/27');
    assert.equal(view.key, 'C');
    assert.equal(view.weeks.length, 10);
    assert.equal(view.brandTeam.manager, manager);
    if (key === 'joao-martins') {
      const past = getClubSeason(community, snapshot, club, '2025/26');
      assert.equal(past.brandTeam.name, 'Jotinha FC');
      assert.equal(clubBrandTeam(community, snapshot, past.team, '2025/26').name, 'Jotinha FC');
    }
  }
  assert.equal(clubForTeam(community, { manager: '' }, '2026/27'), undefined);
});

test('historical league pages use numeric names and contain no modern division rules or emblems', () => {
  const final = getHistoricalLeague(community, '2025/26', '3');
  assert.equal(final.name, 'League 3');
  assert.equal(final.teams[0].name, 'Mikes');
  assert.equal(final.teams[0].total, 1931);
  assert.equal(getHistoricalLeague(community, '2025/26', 'A'), null);
  assert.equal(getHistoricalLeague(community, '2026/27', '1'), null);
  assert.equal(getHistoricalLeague(community, '2025/26', '__proto__'), null);
  assert.equal(getHistoricalLeague(community, '2025/26', '1', 39), null);
  const week = getHistoricalLeague(community, '2025/26', '3', 33);
  assert.equal(week.teams.find(team => team.name === 'Mikes').eventPoints, 114);
  week.teams[0].benchPoints = 0;
  assert.match(renderHistoricalLeague(week, '2025/26', 33, team => team.name), /class="numeric bench-cell">0<\/td>/);
  const html = renderHistoricalLeague(final, '2025/26', 0, team => team.name);
  assert.match(html, /Standalone league/);
  assert.match(html, />Bench<span class="sr-only"> points<\/span><\/th>/);
  assert.match(html, /class="numeric bench-cell">—<\/td>/);
  assert.match(html, /League 3/);
  assert.ok(html.indexOf('value="38"') < html.indexOf('value="1"'));
  assert.doesNotMatch(html, /journal-report|<article|Gameweek results/);
  assert.doesNotMatch(html, /promotion-row|relegation-row|PRE FTW trophy|assets\/league\/thumbs/);
});

test('club season selector and competition link keep the selected season; historical player data is not invented', () => {
  const club = clubForTeam(community, { name: 'Pigui' }, '2025/26');
  const view = getClubSeason(community, current, club, '2025/26');
  const html = renderClubSeason(club, view, ['2026/27', '2025/26'], () => 'Crest');
  assert.match(html, /id="club-season"/);
  assert.match(html, /page=competition/);
  assert.match(html, /league=1/);
  assert.match(html, /season=2025%2F26/);
  assert.match(html, /League 1/);
  assert.match(html, /Gameweek results/);
  assert.match(html, /Pigui FC gameweek results/);
  assert.doesNotMatch(html, /Known as/);
  assert.doesNotMatch(html, /View squad|promotion|relegation/);
  assert.equal(new URLSearchParams(clubRoute(club.key, '2025/26').slice(1)).get('season'), '2025/26');
});

test('historical display uses current names and crest IDs without overwriting historical scores or identities', () => {
  const league = getHistoricalLeague(community, '2025/26', '1');
  const old = league.teams.find(team => team.name === 'Pigui');
  const before = structuredClone(old);
  const brand = clubBrandTeam(community, current, old, '2025/26');
  assert.equal(brand.name, 'Pigui FC');
  assert.equal(brand.id, 15016);
  assert.equal(clubForTeam(community, old, '2025/26').key, 'miguel-fernandes');
  assert.deepEqual(old, before);
  assert.equal(old.total, 1881);
  assert.equal(old.id, null);
  const james = getHistoricalLeague(community, '2025/26', '2').teams.find(team => team.name === 'James');
  assert.equal(clubBrandTeam(community, current, james, '2025/26').name, 'Chelas City');
  const dt = getHistoricalLeague(community, '2025/26', '3').teams.find(team => team.name === 'DT');
  assert.equal(clubBrandTeam(community, current, dt, '2025/26').name, 'DT');
});

test('club identities are unique and link exactly the 14 confirmed returning managers', () => {
  assert.equal(new Set(community.clubs.map(club => club.key)).size, community.clubs.length);
  const returning = community.clubs.filter(club => club.manager && club.historicalNames['2025/26']);
  assert.equal(returning.length, 14);
  for (const club of returning) {
    assert.ok(getClubSeason(community, current, club, '2025/26'));
    assert.ok(getClubSeason(community, current, club, '2026/27'));
  }
  assert.equal(clubForTeam(community, {}, '2025/26'), undefined);
});
