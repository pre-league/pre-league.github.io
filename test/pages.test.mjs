import test from 'node:test';
import assert from 'node:assert/strict';
import { renderWelcome, renderStats, renderArchive } from '../src/pages.mjs';

const config = { season: '2026/27', divisions: ['A', 'B', 'C', 'D'].map(key => ({ key, leagueId: key === 'A' ? 3887 : null })) };
test('welcome is a simple landing page linking to divisions and stats', () => {
  const html = renderWelcome(config, { divisions: {} });
  assert.match(html, /Welcome to PRE FTW League/);
  assert.match(html, /#page=stats/);
  assert.match(html, /#league=A/);
  assert.doesNotMatch(html, /<table/);
  for (const key of ['A', 'B', 'C', 'D']) assert.ok(html.includes(`./assets/league/thumbs/${key}.webp`));
});
test('stats names all three confirmed awards and explains unavailable coverage', () => {
  const html = renderStats(config, { divisions: {} }, 0, () => 'Team');
  for (const name of ["Week’s MVP", 'Absolute Leader', 'Unlucky']) assert.ok(html.includes(name));
  assert.match(html, /No gameweek data/);
});
test('record book escapes historical text without exposing old league tables', () => {
  const html = renderArchive({ documents: [], seasons: [{ season: '2025/26', notes: ['No League D'], leagues: { 1: [], 2: [], 3: [] }, champions: { 1: '<Winner>' }, sources: [] }] });
  assert.match(html, /2025\/26/);
  assert.match(html, /&lt;Winner&gt;/);
  assert.doesNotMatch(html, /<Winner>/);
  assert.doesNotMatch(html, /<table|page=competition/);
  assert.doesNotMatch(html, /<h3>League D/);
});

test('stats include published scores and the selected report without mixing seasons', () => {
  const community = { currentSeason: '2026/27', scoreMethod: 'Published totals', weekly: { 10: { B: { source: 'documentation', teams: [{ id: null, name: 'Chelas City', manager: 'Tiago', division: 'B', gameweekPoints: 83, totalPoints: 488, benchPoints: null }] } } }, reports: [{ gameweek: 10, season: '2026/27', title: '10a Jornada', paragraphs: ['<News>'], sourceUrl: 'https://sites.google.com/view/prefantasydraft/jornal/10a-jornada' }] };
  const html = renderStats(config, { divisions: {} }, 10, team => team.name, community);
  assert.match(html, /Chelas City/);
  assert.match(html, /&lt;News&gt;/);
  assert.match(html, /Published totals/);
  assert.doesNotMatch(renderStats({ ...config, season: '2027/28' }, { divisions: {} }, 10, team => team.name, community), /Chelas City|&lt;News&gt;/);
});

test('archive shows sourced division champions, separate competition podiums and records', () => {
  const html = renderArchive({ seasons: [{ season: '2025/26', leagues: { 1: [], 2: [], 3: [] }, champions: { 1: 'Pigui', 2: 'Miranda', 3: 'Mikes' }, competitions: [{ name: 'Liga Fantasia', podium: ['Pigui', 'Mikes', 'Henrique'].map((name, index) => ({ name, rank: index + 1 })) }] }], records: [{ label: 'Most season points', holder: 'Mikes', value: 1931, unit: 'points', season: '2025/26' }], milestones: [{ text: 'Pigui finished as champion.', season: '2025/26' }] });
  for (const text of ['Pigui', 'Miranda', 'Mikes', 'Liga Fantasia', 'Henrique', '1,931', 'Pigui finished as champion.']) assert.ok(html.includes(text), text);
});

test('stats can select a previous season with its own divisions, scores and source', () => {
  const old = { season: '2025/26', leagues: { 1: [], 2: [], 3: [] }, scoreMethod: 'Imported workbook', weekly: { 38: { 3: { source: 'documentation', teams: [{ id: null, name: 'Mikes', manager: '', division: '3', gameweekPoints: 57, totalPoints: 1931, benchPoints: null }] } } } };
  const html = renderStats(config, { divisions: {} }, 38, team => team.name, { seasons: [old] }, '2025/26');
  assert.match(html, /Mikes/);
  assert.match(html, /1,931/);
  assert.match(html, /id="stats-season"/);
  assert.match(html, /1\/3 leagues/);
  assert.match(html, /Imported workbook/);
  assert.doesNotMatch(html, /API scores take priority/);
});
