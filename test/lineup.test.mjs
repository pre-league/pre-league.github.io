import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineup, renderLineup, handleHeadshotError } from '../src/lineup.mjs';

const squad = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'GK', 'DEF', 'MID', 'FWD']
  .map((position, index) => ({ id: index + 1, slot: index + 1, name: `Player ${index + 1}`, club: 'ARS', position, bench: index >= 11, points: index === 0 ? null : index - 2 }));

test('places starting players in their formation lines and keeps substitutes off the field', () => {
  const lineup = buildLineup([...squad].reverse());
  assert.equal(lineup.formation, '3-4-3');
  assert.deepEqual(lineup.rows.map(row => [row.position, row.players.map(player => player.slot)]), [
    ['FWD', [9, 10, 11]], ['MID', [5, 6, 7, 8]], ['DEF', [2, 3, 4]], ['GK', [1]]
  ]);
  assert.deepEqual(lineup.bench.map(player => player.slot), [12, 13, 14, 15]);
  assert.equal(squad[0].slot, 1);
});

test('derives a different formation from actual roles, without moving bench players into the eleven', () => {
  const changed = structuredClone(squad);
  changed[8].position = 'MID';
  assert.equal(buildLineup(changed).formation, '3-5-2');
});

test('unknown roles remain visible and incomplete teams do not claim a formation', () => {
  const changed = structuredClone(squad);
  changed[1].position = '—';
  const lineup = buildLineup(changed);
  assert.equal(lineup.formation, null);
  assert.equal(lineup.rows.flatMap(row => row.players).length, 11);
  assert.equal(buildLineup(squad.slice(0, 5)).formation, null);
});

test('renders the pitch, bench and full list with escaped names and actual points', () => {
  const changed = structuredClone(squad);
  changed[0].name = '<img src=x onerror="alert(1)">';
  const html = renderLineup({ squad: changed, squadGameweek: 10 });
  assert.match(html, /<div class="panel-heading">[\s\S]*3-4-3[\s\S]*GW 10<\/span><\/div>\s*<div class="lineup-pitch"/);
  assert.match(html, /Bench/);
  assert.match(html, /View player list/);
  assert.match(html, /&lt;img src=x/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /Gameweek points: <\/span>—/);
  assert.match(html, /Gameweek points: <\/span>0/);
  assert.match(html, /Gameweek points: <\/span>-1/);
});

test('unsynced squads show an empty pitch with no invented players', () => {
  for (const missing of [null, []]) {
    const html = renderLineup({ squad: missing, squadGameweek: null });
    assert.match(html, /Awaiting first sync/);
    assert.doesNotMatch(html, /class="pitch-player"/);
  }
});

test('headshots use a fixed official image host and keep a fallback for missing photos', () => {
  const players = structuredClone(squad);
  players[0].photoCode = 118748;
  players[1].photoCode = '1" onerror="bad()';
  const html = renderLineup({ squad: players, squadGameweek: 10 });
  assert.match(html, /src="https:\/\/resources.premierleague.com\/premierleague25\/photos\/players\/250x250\/118748.png"/);
  assert.match(html, /data-fallback-src="https:\/\/resources.premierleague.com\/premierleague25\/photos\/players\/110x140\/118748.png"/);
  assert.equal((html.match(/class="player-headshot"/g) ?? []).length, 1);
  assert.doesNotMatch(html, / onerror=/);
  assert.match(html, /<svg/);
});

test('failed headshots are removed to reveal the existing fallback without retry loops', () => {
  let removed = 0;
  handleHeadshotError({ target: { matches: selector => selector === 'img.player-headshot', remove: () => removed++ } });
  handleHeadshotError({ target: { matches: () => false, remove: () => removed++ } });
  assert.equal(removed, 1);
});

test('missing large portraits try the original image once before showing the shirt', () => {
  let removed = 0;
  const image = {
    matches: () => true,
    dataset: { fallbackSrc: 'https://resources.premierleague.com/premierleague25/photos/players/110x140/118748.png' },
    src: '',
    remove: () => removed++
  };
  handleHeadshotError({ target: image });
  assert.match(image.src, /110x140\/118748.png$/);
  assert.equal(image.dataset.fallbackSrc, undefined);
  assert.equal(removed, 0);
  handleHeadshotError({ target: image });
  assert.equal(removed, 1);
});

test('head coach uses the manager name outside the squad and is escaped even before squad sync', () => {
  for (const players of [squad, null]) {
    const html = renderLineup({ squad: players, squadGameweek: 10, manager: 'Coach <script>bad()</script>' });
    assert.match(html, /Head Coach/);
    assert.match(html, /Coach &lt;script&gt;bad\(\)&lt;\/script&gt;/);
    assert.doesNotMatch(html, /Coach <script>/);
  }
});
