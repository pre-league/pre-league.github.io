import { escapeHtml as e, sameManager } from './model.mjs';
import { gameweekLabel, leagueLabel, number, teamCount, t } from './locale.mjs';
import { combinedWeeklyRecords, teamBenchPoints } from './stats.mjs';

const points = value => number(value, { maximumFractionDigits: 1 });
export const clubRoute = (key, season) => `#${new URLSearchParams({ page: 'club', club: key, season })}`;
export const historicalLeagueRoute = (key, season, week = 0) => `#${new URLSearchParams({ page: 'competition', league: key, season, ...(week ? { gw: week } : {}) })}`;

export function clubForTeam(community, team, season) {
  const historical = (community.seasons ?? []).some(row => row.season === season);
  return (community.clubs ?? []).find(club => historical
    ? club.historicalNames[season] && club.historicalNames[season] === team.name
    : sameManager(club.manager, team.manager));
}

export function clubBrandTeam(community, snapshot, team, season) {
  const club = clubForTeam(community, team, season);
  if (!club?.manager) return team;
  const current = Object.values(snapshot.divisions ?? {}).flatMap(league => league.teams).find(row => sameManager(row.manager, club.manager));
  if (current) return current;
  const week = Math.max(...Object.keys(community.weekly ?? {}).map(Number));
  return Object.values(community.weekly?.[week] ?? {}).flatMap(league => league.teams).find(row => sameManager(row.manager, club.manager)) ?? team;
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
  const current = Object.entries(snapshot.divisions ?? {}).find(([, league]) => club.manager && league.teams.some(team => sameManager(team.manager, club.manager)));
  const brandTeam = current?.[1].teams.find(team => sameManager(team.manager, club.manager));
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
    const row = teams.find(row => historical ? row.name === team.name : sameManager(row.manager, club.manager));
    return row ? [{ gameweek, points: row.gameweekPoints, total: row.totalPoints, rank: 1 + teams.filter(other => other.totalPoints > row.totalPoints).length }] : [];
  });
  return { season, historical, league, key, team, brandTeam: brandTeam ?? clubBrandTeam(community, snapshot, team, season), weeks };
}

export function renderClubIdentity(team, key, competition, badge, seasonControl) {
  return `<div class="club-identity"><a class="club-back" href="${competition}" aria-label="${t("← League {0} standings", e(key))}"><span aria-hidden="true">←</span></a>
    <section class="team-hero">${badge(team, true)}<div><h1>${e(team.name)}</h1><p>${team.manager ? t("Managed by {0}", e(team.manager)) : t("Manager not recorded")}</p></div></section>${seasonControl}</div>`;
}

export function renderClubGameweeks(view) {
  return `<details class="panel club-gameweeks quiet-disclosure"><summary>${t("Gameweek results")} <span>${t("{0} saved", view.weeks.length)}</span></summary>${view.weeks.length ? `<div class="stats-table-scroll"><table><caption class="sr-only">${t("{0} gameweek results in {1}, {2}", e(view.brandTeam.name), leagueLabel(e(view.key)), e(view.season))}</caption><thead><tr><th scope="col">${t("GW")}</th><th scope="col" class="numeric">${t("Points")}</th><th scope="col" class="numeric">${t("Total")}</th><th scope="col" class="numeric">${t("Rank")}</th></tr></thead><tbody>${view.weeks.map(week => `<tr><td>${week.gameweek}</td><td class="numeric">${points(week.points)}</td><td class="numeric">${points(week.total)}</td><td class="numeric">${week.rank}</td></tr>`).join('')}</tbody></table></div><p class="panel-copy">${t("Weekly rank is calculated from cumulative league points; tied totals share a rank.")}</p>` : `<p class="panel-copy">${t("No weekly scores have been saved for this season.")}</p>`}</details>`;
}

export function renderClubSeason(club, view, seasons, badge, transferLink = '') {
  const scores = view.weeks.map(week => week.points).filter(Number.isSafeInteger);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const best = scores.length ? Math.max(...scores) : null;
  const competition = view.historical ? historicalLeagueRoute(view.key, view.season) : `#league=${view.key}&tab=standings`;
  const seasonControl = `<div class="control-field club-season-control"><label for="club-season" class="sr-only">${t("Season")}</label><select id="club-season" data-club="${e(club.key)}">${seasons.map(season => `<option value="${e(season)}"${season === view.season ? ' selected' : ''}>${e(season)}</option>`).join('')}</select></div>`;
  return `${renderClubIdentity({ ...view.brandTeam, manager: club.manager }, view.key, competition, badge, seasonControl)}
    <div class="club-links"><a class="club-competition" href="${competition}">${leagueLabel(e(view.key))} <span aria-hidden="true">↗</span></a>${transferLink}<span>${view.historical ? t("Standalone league · Completed season") : t("Current season")}</span></div>
    <div class="team-summary"><div><span>${view.historical ? t("Final position") : t("League position")}</span><strong>${points(view.team.rank)}<small> / ${view.league.teams.length}</small></strong></div><div><span>${t("Season points")}</span><strong>${points(view.team.total)}</strong></div><div><span>${t("Avg / saved GW")}</span><strong>${points(average)}</strong></div><div><span>${t("Best saved GW")}</span><strong class="accent">${points(best)}</strong></div></div>
    ${view.historical ? `${renderClubGameweeks(view)}<p class="archive-note">${t("Historical lineups, transfers and bench scores were not supplied.")}</p>` : ''}`;
}

export function renderHistoricalLeague(league, season, week, teamLink) {
  return `<div class="page-heading"><span class="eyebrow">${e(season)}${t(" · Standalone league")}</span><h1>${leagueLabel(e(league.key))}</h1><p>${t("These leagues were independent competitions. No promotion or relegation applied.")}</p></div>
    <section class="panel standings"><h2 class="sr-only">${week ? t("Gameweek {0}", week) : t("Final standings")}</h2><div class="history-control table-toolbar"><div class="control-field"><label for="historical-week">${t("Standings")}</label><select id="historical-week"><option value="0"${!week ? ' selected' : ''}>${t("Final table")}</option>${[...league.weeks].sort((a, b) => b - a).map(value => `<option value="${value}"${value === week ? ' selected' : ''}>${gameweekLabel(value)}</option>`).join('')}</select></div><p>${teamCount(league.teams.length)}</p></div><div class="standings-scroll" role="region" aria-label="${t("League {0} standings", e(league.key))}" tabindex="0"><table><caption class="sr-only">${leagueLabel(e(league.key))}, ${e(season)}, ${week ? t("Gameweek {0}", week) : t("Final standings")}</caption><thead><tr><th scope="col" class="rank-col">#</th><th scope="col">${t("Club")}</th><th scope="col" class="numeric">${gameweekLabel(week || 38)}</th><th scope="col" class="numeric">${t("Bench")}<span class="sr-only">${t(" points")}</span></th><th scope="col" class="numeric">PTS</th></tr></thead><tbody>${league.teams.map(team => `<tr${!week && team.rank === 1 ? ' class="trophy-row"' : ''}><td class="rank-col">${team.rank}${!week && team.rank === 1 ? '<span class="sr-only">${t("League champion")}</span>' : ''}</td><td>${teamLink(team, league.key, season)}</td><td class="numeric">${points(team.eventPoints)}</td><td class="numeric bench-cell">${points(teamBenchPoints(team, week || 38))}</td><td class="numeric points-cell">${points(team.total)}</td></tr>`).join('')}</tbody></table></div>${!week ? `<div class="table-foot"><div class="places-legend"><span class="trophy"><i class="legend-line"></i>${t("League champion")}</span></div><span>${t("Completed season")}</span></div>` : ''}${league.teams.length ? '' : `<p class="no-results" role="status">${t("No teams match your search.")}</p>`}</section>
    <div class="archive-sources">${league.sources.map(source => `<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(t(source.title))} ↗</a>`).join('')}</div>`;
}
