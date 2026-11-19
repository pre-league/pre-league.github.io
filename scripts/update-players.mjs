import { readFile, rename, writeFile } from 'node:fs/promises';

const data = new URL('../data/', import.meta.url);
const load = name => readFile(new URL(name, data), 'utf8').then(JSON.parse);
async function get(path) {
  const response = await fetch('https://draft.premierleague.com/api/' + path, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Draft API ${response.status}: ${path}`);
  return response.json();
}
const config = await load('config.json');
const latest = await load('latest.json');
const catalog = await get('bootstrap-static');
const events = catalog.events.data;
if (latest.season !== config.season || !events[0].deadline_time.startsWith(config.season.slice(0, 4))) throw new Error('Player data season mismatch');
const previous = await load('players.json').catch(error => { if (error.code !== 'ENOENT') throw error; });
const weeks = previous?.season === config.season && previous.scoring === 'final-xi' ? previous.weeks : {};
const players = Object.fromEntries(catalog.elements.map(p => [p.id, {
  name: p.web_name, fullName: [p.first_name, p.second_name].filter(Boolean).join(' '), photoCode: p.code,
  club: catalog.teams.find(team => team.id === p.team)?.short_name, position: ['GK','DEF','MID','FWD'][p.element_type - 1],
  points: p.total_points, minutes: p.minutes, goals: p.goals_scored, assists: p.assists, cleanSheets: p.clean_sheets, bonus: p.bonus
}]));
for (const event of events.filter(event => event.id <= catalog.events.current)) {
  const week = weeks[event.id] ??= { squads: {}, points: {} };
  if (!week.final) {
    try {
      const live = await get(`event/${event.id}/live`);
      const scores = Object.fromEntries(Object.entries(live.elements).flatMap(([id, p]) =>
        Number.isSafeInteger(p.stats?.total_points) ? [[p.id ?? id, p.stats.total_points]] : []));
      if (!Object.keys(scores).length) throw new Error('Empty player scores');
      week.points = scores;
    } catch (error) { console.warn(error.message); process.exitCode = 1; continue; }
  }
  let complete = true;
  for (const { key, leagueId } of config.divisions) {
    const league = latest.divisions[key];
    if (!leagueId || league?.leagueId !== leagueId) continue;
    const squads = week.squads[key] ??= {};
    await Promise.all(league.teams.map(async team => {
      if (week.final && squads[team.id]) return;
      try {
        const { picks } = await get(`entry/${team.id}/event/${event.id}`);
        if (picks?.length !== 15 || new Set(picks.map(p => p.element)).size !== 15 ||
          new Set(picks.map(p => p.position)).size !== 15 || picks.some(p => !players[p.element] || !Number.isInteger(p.position) || p.position < 1 || p.position > 15)) throw new Error('Incomplete squad');
        // Draft supplies the post-substitution XI in slots 1 through 11; bench multipliers can also be 1.
        squads[team.id] = picks.map(p => [p.element, p.position <= 11 ? 1 : 0]);
      } catch (error) { complete = false; console.warn(`GW ${event.id} entry ${team.id}: ${error.message}`); process.exitCode = 1; }
    }));
  }
  week.final = event.finished && complete;
}
const owners = {};
for (const { key, leagueId } of config.divisions.filter(d => d.leagueId)) {
  try {
    const { element_status } = await get(`league/${leagueId}/element-status`);
    owners[key] = Object.fromEntries(element_status.map(row => [row.element, row.owner]));
  } catch (error) { console.warn(error.message); process.exitCode = 1; }
}
const file = new URL('players.json', data);
const tmp = new URL('players.json.tmp', data);
await writeFile(tmp, JSON.stringify({ season: config.season, scoring: 'final-xi', players, weeks, owners }) + '\n');
await rename(tmp, file);
console.log(`Saved ${Object.keys(players).length} players and ${Object.keys(weeks).length} gameweeks`);
