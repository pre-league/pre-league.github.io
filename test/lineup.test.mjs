import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLineup, renderLineup, handleHeadshotError } from '../src/lineup.mjs';
import { refreshPitchRoles, roleCode } from '../scripts/pitch-roles.mjs';

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

test('all eight legal formations keep every starter in their FPL band', () => {
  for (const formation of ['3-4-3', '3-5-2', '4-3-3', '4-4-2', '4-5-1', '5-2-3', '5-3-2', '5-4-1']) {
    const [def, mid, fwd] = formation.split('-').map(Number);
    const positions = ['GK', ...Array(def).fill('DEF'), ...Array(mid).fill('MID'), ...Array(fwd).fill('FWD')];
    const players = positions.map((position, slot) => ({ position, slot, photoCode: slot + 1 }));
    const roles = Object.fromEntries(players.map(p => [p.photoCode, 'RW']));
    const lineup = buildLineup(players, roles);
    assert.equal(lineup.formation, formation);
    assert.deepEqual(lineup.rows.flatMap(r => r.players).sort((a, b) => a.slot - b.slot), players);
    assert.ok(lineup.rows.every(r => r.players.every(p => p.position === r.position)));
    if (mid === 5) assert.deepEqual(lineup.rows.filter(r => r.position === 'MID').map(r => r.players.length), [3, 2]);
  }
});

test('five midfielders fit both wings, with the first of two number tens in the advanced centre', () => {
  const roles = { 1: 'AM', 2: 'RW', 3: 'AM', 4: 'CM', 5: 'W' };
  const players = Object.keys(roles).map(Number).map(slot => ({ slot, position: 'MID', photoCode: slot }));
  const slots = input => buildLineup(input, roles).rows.map(r => r.players.map(p => p.slot));
  assert.deepEqual(slots(players), [[5, 1, 2], [3, 4]]);
  assert.deepEqual(slots([...players].reverse()), slots(players));
  assert.deepEqual(buildLineup(players).rows.map(r => r.players.map(p => p.slot)), [[1, 2, 3], [4, 5]]);
});

test('roles join by Opta code, use the requested season and survive provider outages', async () => {
  assert.equal(roleCode('Left/Centre/Right Attacking Midfielder'), 'AM');
  assert.equal(roleCode('Left Full Back'), 'LFB');
  assert.equal(roleCode('Right Winger'), 'RW');
  assert.equal(roleCode('Midfielder'), undefined);
  const now = '2026-11-20T00:00:00Z';
  const cached = await refreshPitchRoles('2026/27', undefined, now, async path => {
    if (path.startsWith('competitions/')) return { content: [{ label: 'English Premier League Season 2026/2027', id: 841 }] };
    assert.match(path, /compSeasons=841/);
    const records = [[141746, 'Attacking Midfielder'], [466075, 'Left Full Back'], [494521, 'Left Full Back'],
      [430871, 'Left/Centre Striker'], [614071, 'Central Midfielder']];
    return { pageInfo: { numPages: 1 }, content: records.map(([id, positionInfo]) => ({ altIds: { opta: 'p' + id }, info: { positionInfo } })) };
  });
  assert.deepEqual(cached.byCode, { 141746: 'AM', 466075: ['LFB', 'CB'], 494521: 'LFB',
    430871: ['LW', 'AM', 'ST'], 614071: ['DM', 'CM', 'AM', 'LW'] });
  const midfield = [614071, 204480, 466052, 430871].map((photoCode, slot) => ({ photoCode, slot, position: 'MID' }));
  const diamond = buildLineup(midfield, { ...cached.byCode, 204480: 'CM', 466052: 'AM' });
  assert.deepEqual(diamond.rows.map(row => row.players.map(p => p.photoCode)), [[466052], [430871, 204480], [614071]]);
  let attempts = 0;
  const offline = () => { attempts++; throw Error('offline'); };
  assert.equal(await refreshPitchRoles('2026/27', cached, now, offline), cached);
  assert.equal(attempts, 0);
  assert.equal(await refreshPitchRoles('2026/27', cached, '2026-12-01', offline), cached);
  assert.equal(attempts, 1);
});

test('a versatile left-back moves inside for a specialist and returns outside when the slot is free', () => {
  const roles = { 1: ['LFB', 'CB'], 2: 'CB', 3: 'LFB', 4: 'RFB', 5: 'CB' };
  function backFour(codes) {
    const defenders = codes.map((photoCode, slot) => ({ photoCode, slot, position: 'DEF' }));
    return buildLineup(defenders, roles).rows[0].players.map(p => p.photoCode);
  }
  assert.deepEqual(backFour([1, 3, 2, 4]), [3, 1, 2, 4]);
  assert.deepEqual(backFour([2, 1, 5, 4]), [1, 2, 5, 4]);
});

test('unknown roles remain visible and incomplete teams do not claim a formation', () => {
  const changed = structuredClone(squad);
  changed[1].position = '—';
  const lineup = buildLineup(changed);
  assert.equal(lineup.formation, null);
  assert.equal(lineup.rows.flatMap(row => row.players).length, 11);
  assert.equal(buildLineup(squad.slice(0, 5)).formation, null);
});

test('a striker classified as a midfielder cannot take an attacking midfielder’s exact match', () => {
  const roles = ['LW', 'ST', 'AM', 'CM', 'CM'];
  const players = roles.map((role, slot) => ({ slot, photoCode: slot, position: 'MID' }));
  const lineup = buildLineup(players, roles);
  assert.equal(lineup.rows[0].players[1].slot, 2);
});

test('three midfielders can play with a holding player or as an attacking trio', () => {
  for (const [roles, expected] of [
    [['DM', 'CM', 'CM'], [[1, 2], [0]]],
    [['RW', 'LW', 'AM'], [[1, 2, 0]]]
  ]) {
    const players = roles.map((role, slot) => ({ slot, photoCode: slot, position: 'MID' }));
    assert.deepEqual(buildLineup(players, roles).rows.map(row => row.players.map(p => p.slot)), expected);
  }
});

test('an illegal 2-5-3 still shows all eleven starters without advertising a formation', () => {
  const players = squad.map(p => p.slot === 2 ? { ...p, position: 'MID' } : p);
  const lineup = buildLineup(players);
  assert.equal(lineup.formation, null);
  assert.equal(lineup.rows.flatMap(row => row.players).length, 11);
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

test('forwards show attacking returns and never display a clean-sheet badge', () => {
  const player = { ...squad[8], goals: 1, assists: 1, cleanSheets: 1 };
  const html = renderLineup({ squad: [player] });
  assert.match(html, /class="pitch-event goals"/);
  assert.match(html, /class="pitch-event assists"/);
  assert.doesNotMatch(html, /class="pitch-event cleanSheets"/);
});

test('the top scorer star follows the best known starting score, including ties', () => {
  const players = squad.map(player => ({ ...player, points: null }));
  const view = () => renderLineup({ squad: players });
  assert.doesNotMatch(view(), /class="pitch-star"/);
  players[11].points = 10;
  players[0].points = -1;
  assert.equal(view().match(/class="pitch-star"/g)?.length, 1);
  players[1].points = -1;
  assert.equal(view().match(/class="pitch-star"/g)?.length, 2);
  assert.doesNotMatch(view().split('class="bench-heading"')[1], /class="pitch-star"/);
});

test('pending fixtures have blank scores on the pitch, bench and list and cannot win the star', () => {
  const players = squad.map(player => ({ ...player, points: 0, awaitingKickoff: true }));
  const view = () => renderLineup({ squad: players });
  assert.doesNotMatch(view(), /class="pitch-(score|star)|class="numeric points-cell">0/);
  players[0].awaitingKickoff = false;
  players[0].points = -1;
  players[11].awaitingKickoff = false;
  const html = view();
  assert.equal(html.match(/class="pitch-score/g).length, 2);
  assert.equal(html.match(/class="pitch-star"/g).length, 1);
  assert.match(html, /class="numeric points-cell">0<\/td>/);
});

test('pitch badges use inclusive score bands and only show recorded events', () => {
  for (const [points, color] of [[null, 'unknown'], [-1, 'red'], [2, 'red'], [3, 'yellow'], [5, 'yellow'], [6, 'green'], [9, 'green'], [10, 'blue']]) {
    const html = renderLineup({ squad: [{ ...squad[0], points, goals: 2, assists: 0, cleanSheets: 1 }] });
    assert.ok(html.includes(`class="pitch-score ${color}"`));
    assert.match(html, /aria-label="Goals: 2"/);
    assert.match(html, /aria-label="Clean sheets: 1"/);
    assert.doesNotMatch(html, /class="pitch-event assists"/);
  }
});

test('headshots use a fixed official image host and keep a fallback for missing photos', () => {
  const players = structuredClone(squad);
  players[0].photoCode = 118748;
  players[1].photoCode = '1" onerror="bad()';
  const html = renderLineup({ squad: players, squadGameweek: 10 });
  assert.match(html, /src="https:\/\/resources.premierleague.com\/premierleague25\/photos\/players\/110x140\/118748.png"/);
  assert.match(html, /data-fallback-src="https:\/\/resources.premierleague.com\/premierleague\/photos\/players\/250x250\/p118748.png"/);
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
    dataset: { fallbackSrc: 'https://resources.premierleague.com/premierleague/photos/players/250x250/p118748.png' },
    src: '',
    remove: () => removed++
  };
  handleHeadshotError({ target: image });
  assert.match(image.src, /250x250\/p118748.png$/);
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
