import { escapeHtml as e } from './model.mjs';
import { combinedWeeklyRecords } from './stats.mjs';

const points = value => value == null ? '—' : new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(value);
export const clubRoute = (key, season) => `#${new URLSearchParams({ page: 'club', club: key, season })}`;
export const historicalLeagueRoute = (key, season, week = 0) => `#${new URLSearchParams({ page: 'competition', league: key, season, ...(week ? { gw: week } : {}) })}`;

export function clubForTeam(community, team, season) {
  const historical = (community.seasons ?? []).some(row => row.season === season);
  return (community.clubs ?? []).find(club => historical
    ? club.historicalNames[season] && club.historicalNames[season] === team.name
    : club.manager && club.manager === team.manager);
}

export function clubBrandTeam(community, snapshot, team, season) {
  const club = clubForTeam(community, team, season);
  if (!club?.manager) return team;
  const current = Object.values(snapshot.divisions ?? {}).flatMap(league => league.teams).find(row => row.manager === club.manager);
  if (current) return current;
  const week = Math.max(...Object.keys(community.weekly ?? {}).map(Number));
  return Object.values(community.weekly?.[week] ?? {}).flatMap(league => league.teams).find(row => row.manager === club.manager) ?? team;
}

export function getHistoricalLeague(community, selectedSeason, key, week = 0) {
  const season = (community.seasons ?? []).find(row => row.season === selectedSeason && row.format === 'standalone');
  if (!Array.isArray(season?.leagues?.[key]) || !Number.isInteger(week) || week < 0 || week > 38) return null;
  const records = week ? season.weekly?.[week]?.[key]?.teams : null;
  if (week && !records) return null;
  const teams = records ? [...records].sort((a, b) => b.totalPoints - a.totalPoints).map(row => ({
    ...row, total: row.totalPoints, eventPoints: row.gameweekPoints,
    rank: 1 + records.filter(other => other.totalPoints > row.totalPoints).length
  })) : season.leagues[key].map(team => ({
    ...team, id: null, eventPoints: season.weekly?.[38]?.[key]?.teams.find(row => row.name === team.name)?.gameweekPoints ?? null
  }));
  return { name: `League ${key}`, key, teams: teams.map(team => ({ ...team, manager: clubForTeam(community, team, selectedSeason)?.manager ?? team.manager })), weekly: season.weekly, sources: season.sources ?? [], weeks: Object.keys(season.weekly ?? {}).map(Number).sort((a, b) => a - b) };
}

export function getClubSeason(community, snapshot, club, season) {
  const current = Object.entries(snapshot.divisions ?? {}).find(([, league]) => club.manager && league.teams.some(team => team.manager === club.manager));
  const brandTeam = current?.[1].teams.find(team => team.manager === club.manager);
  let league, key, team, weekly;
  const historical = season !== (snapshot.season ?? community.currentSeason);
  if (!historical) {
    if (!current) return null;
    [key, league] = current;
    league = { ...league, name: `League ${key}` };
    team = brandTeam;
    weekly = combinedWeeklyRecords(snapshot, community, season);
  } else {
    const old = (community.seasons ?? []).find(row => row.season === season);
    const match = Object.entries(old?.leagues ?? {}).find(([, teams]) => teams.some(team => team.name === club.historicalNames[season]));
    if (!match) return null;
    key = match[0];
    league = getHistoricalLeague(community, season, key);
    if (!league) return null;
    team = { ...league.teams.find(team => team.name === club.historicalNames[season]), manager: club.manager };
    weekly = old.weekly;
  }
  const weeks = Object.keys(weekly ?? {}).map(Number).sort((a, b) => a - b).flatMap(gameweek => {
    const teams = weekly[gameweek][key]?.teams ?? [];
    const row = teams.find(row => historical ? row.name === team.name : row.manager === club.manager);
    return row ? [{ gameweek, points: row.gameweekPoints, total: row.totalPoints, rank: 1 + teams.filter(other => other.totalPoints > row.totalPoints).length }] : [];
  });
  return { season, historical, league, key, team, brandTeam: brandTeam ?? clubBrandTeam(community, snapshot, team, season), weeks };
}

export function renderClubSeason(club, view, seasons, badge) {
  const scores = view.weeks.map(week => week.points).filter(Number.isSafeInteger);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const best = scores.length ? Math.max(...scores) : null;
  const competition = view.historical ? historicalLeagueRoute(view.key, view.season) : `#league=${view.key}&tab=standings`;
  return `<a class="back-link" href="${competition}">← ${e(view.league.name)} standings</a>
    <section class="team-hero">${badge(view.brandTeam, true)}<div><span class="eyebrow">${e(view.season)}</span><h1>${e(view.brandTeam.name)}</h1>${club.manager ? `<p>Managed by ${e(club.manager)}</p>` : '<p>Manager not recorded</p>'}</div></section>
    <div class="stats-toolbar club-season-control"><label for="club-season">Season</label><select id="club-season" data-club="${e(club.key)}">${seasons.map(season => `<option value="${e(season)}"${season === view.season ? ' selected' : ''}>${e(season)}</option>`).join('')}</select><a class="club-competition" href="${competition}">${e(view.league.name)} <span aria-hidden="true">↗</span></a><span>${view.historical ? 'Standalone league · Completed season' : 'Current season'}</span></div>
    <div class="team-summary"><div><span>${view.historical ? 'Final position' : 'League position'}</span><strong>${points(view.team.rank)}<small> / ${view.league.teams.length}</small></strong></div><div><span>Season points</span><strong>${points(view.team.total)}</strong></div><div><span>Avg / saved GW</span><strong>${points(average)}</strong></div><div><span>Best saved GW</span><strong class="accent">${points(best)}</strong></div></div>
    <details class="panel club-gameweeks"><summary>Gameweek results <span>${view.weeks.length} saved</span></summary>${view.weeks.length ? `<div class="stats-table-scroll"><table><caption class="sr-only">${e(view.brandTeam.name)} gameweek results in ${e(view.league.name)}, ${e(view.season)}</caption><thead><tr><th scope="col">GW</th><th scope="col" class="numeric">Points</th><th scope="col" class="numeric">Total</th><th scope="col" class="numeric">Rank</th></tr></thead><tbody>${view.weeks.map(week => `<tr><td>${week.gameweek}</td><td class="numeric">${points(week.points)}</td><td class="numeric">${points(week.total)}</td><td class="numeric">${week.rank}</td></tr>`).join('')}</tbody></table></div><p class="panel-copy">Weekly rank is calculated from cumulative league points; tied totals share a rank.</p>` : '<p class="panel-copy">No weekly scores have been saved for this season.</p>'}</details>
    ${view.historical ? '<p class="archive-note">Historical lineups, transfers and bench scores were not supplied.</p>' : ''}`;
}

export function renderHistoricalLeague(league, season, week, teamLink) {
  return `<div class="page-heading"><span class="eyebrow">${e(season)} · Standalone league</span><h1>${e(league.name)}</h1><p>These leagues were independent competitions. No promotion or relegation applied.</p></div>
    <div class="stats-toolbar"><label for="historical-week">Standings</label><select id="historical-week"><option value="0"${!week ? ' selected' : ''}>Final table</option>${[...league.weeks].sort((a, b) => b - a).map(value => `<option value="${value}"${value === week ? ' selected' : ''}>GW ${value}</option>`).join('')}</select><span>${league.teams.length} teams</span></div>
    <section class="panel standings"><div class="panel-heading"><h2>${week ? `Gameweek ${week}` : 'Final standings'}</h2></div><table><caption class="sr-only">${e(league.name)}, ${e(season)}, ${week ? `gameweek ${week}` : 'final standings'}</caption><thead><tr><th scope="col">#</th><th scope="col">Club</th><th scope="col" class="numeric">GW ${week || 38}</th><th scope="col" class="numeric">PTS</th></tr></thead><tbody>${league.teams.map(team => `<tr${!week && team.rank === 1 ? ' class="trophy-row"' : ''}><td>${team.rank}${!week && team.rank === 1 ? '<span class="sr-only">League champion</span>' : ''}</td><td>${teamLink(team, league.key, '', season)}</td><td class="numeric">${points(team.eventPoints)}</td><td class="numeric points-cell">${points(team.total)}</td></tr>`).join('')}</tbody></table>${!week ? '<div class="table-foot"><div class="places-legend"><span class="trophy"><i class="legend-line"></i>League champion</span></div><span>Completed season</span></div>' : ''}${league.teams.length ? '' : '<p class="no-results" role="status">No teams match your search.</p>'}</section>
    <div class="archive-sources">${league.sources.map(source => `<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)} ↗</a>`).join('')}</div>`;
}
