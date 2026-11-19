import { weekControl } from './gameweek.mjs';
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
  const weeks = clubWeeks(weekly, key, team, historical);
  return { season, historical, league, key, team, brandTeam: brandTeam ?? clubBrandTeam(community, snapshot, team, season), weeks };
}

export function clubWeeks(weekly, key, team, historical = false) {
  return Object.keys(weekly ?? {}).map(Number).sort((a, b) => a - b).flatMap(gameweek => {
    const teams = weekly[gameweek][key]?.teams ?? [];
    const row = teams.find(row => historical ? row.name === team.name :
      (team.id != null && row.id === team.id) || sameManager(row.manager, team.manager));
    if (!row) return [];
    const scores = teams.map(other => other.gameweekPoints);
    const comparable = scores.length > 1 && scores.every(Number.isSafeInteger);
    return [{ gameweek, points: row.gameweekPoints, total: row.totalPoints,
      leagueSize: teams.length,
      rank: teams.every(other => Number.isSafeInteger(other.totalPoints)) ? 1 + teams.filter(other => other.totalPoints > row.totalPoints).length : null,
      bench: row.benchPoints,
      divisionAverage: comparable ? scores.reduce((sum, n) => sum + n, 0) / scores.length : null,
      topScore: comparable ? Math.max(...scores) : null }];
  });
}

function gameweekChart(weeks, field) {
  const position = field === 'rank';
  const known = weeks.filter(w => Number.isSafeInteger(w[field]) && (!position || w.rank > 0));
  if (!known.length) return '';
  const first = weeks[0].gameweek;
  const last = weeks.at(-1).gameweek;
  const x = gw => first === last ? 50 : (gw - first) / (last - first) * 100;
  let ticks;
  if (position) {
    const size = Math.max(...known.map(w => w.leagueSize ?? w.rank));
    ticks = Array.from({ length: size }, (_, i) => i + 1);
  } else {
    const scores = known.map(w => w.points);
    const low = Math.min(0, ...scores);
    const high = Math.max(0, ...scores);
    const step = Math.max(1, Math.ceil((high - low) / 20) * 5);
    const top = Math.max(Math.ceil(high / step), low === high ? 1 : 0);
    ticks = Array.from({ length: top - Math.floor(low / step) + 1 }, (_, i) => (top - i) * step);
  }
  const y = value => (value - ticks[0]) / (ticks.at(-1) - ticks[0] || 1) * 100;
  const label = w => position ? `#${w.rank}` : t("{0} pts", number(w.points));
  const intervals = Math.min(last - first, 9);
  const compactTicks = new Set([0, Math.round(intervals / 3), Math.round(2 * intervals / 3), intervals]);
  const weekTicks = Array.from({ length: intervals + 1 }, (_, i) =>
    first + Math.round(i * (last - first) / Math.max(1, intervals)));
  return `<section class="panel gameweek-chart"><div class="panel-heading"><h2 id="${field}-title">${t(position ? "League position" : "Points per gameweek")}</h2></div>
    <svg ${position ? 'role="img"' : `id="score-plot" tabindex="0" role="slider" aria-valuemin="1" aria-valuemax="${known.length}" aria-valuenow="1" aria-valuetext="${gameweekLabel(known[0].gameweek)} · ${label(known[0])}"`} aria-labelledby="${field}-title"${position ? ' aria-describedby="rank-values"' : ''}>
      <desc id="${field}-values">${known.map(w => `${gameweekLabel(w.gameweek)}: ${label(w)}`).join(', ')}</desc>
      ${ticks.map(tick => `<text x="-10" y="${y(tick)}%" dy=".35em" text-anchor="end">${number(tick)}</text><line x2="100%" y1="${y(tick)}%" y2="${y(tick)}%"/>`).join('')}
      ${known.map((w, i) => {
        const prev = known[i - 1];
        return prev?.gameweek === w.gameweek - 1 ? `<line class="chart-segment" x1="${x(prev.gameweek)}%" y1="${y(prev[field])}%" x2="${x(w.gameweek)}%" y2="${y(w[field])}%"/>` : '';
      }).join('')}
      ${known.map(w => `<circle cx="${x(w.gameweek)}%" cy="${y(w[field])}%" r="3"${position ? '' : ` data-score="${gameweekLabel(w.gameweek)} · ${label(w)}"`}>${position ? `<title>${gameweekLabel(w.gameweek)} &middot; ${label(w)}</title>` : ''}</circle>`).join('')}
      ${weekTicks.map((gw, i) => `<text class="${!compactTicks.has(i) && intervals > 3 ? 'intermediate-week' : 'week-tick'}" x="${x(gw)}%" y="100%" dy="22" text-anchor="${first === last ? 'middle' : gw === first ? 'start' : gw === last ? 'end' : 'middle'}">${gameweekLabel(gw)}</text>`).join('')}
      ${position ? '' : '<g class="score-callout" aria-hidden="true" visibility="hidden"><circle r="5"/><text></text></g>'}
    </svg></section>`;
}

export function bindScorePlot() {
  const plot = document.querySelector('#score-plot');
  if (!plot) return;
  const dots = [...plot.querySelectorAll('[data-score]')];
  const callout = plot.querySelector('.score-callout');
  const marker = callout.querySelector('circle');
  const text = callout.querySelector('text');
  let selected = 0;
  function show(index) {
    selected = index;
    const dot = dots[index];
    const x = dot.getAttribute('cx');
    const y = dot.getAttribute('cy');
    marker.setAttribute('cx', x);
    marker.setAttribute('cy', y);
    text.setAttribute('x', x);
    text.setAttribute('y', y);
    text.setAttribute('dy', parseFloat(y) < 20 ? 23 : -13);
    text.setAttribute('text-anchor', parseFloat(x) < 30 ? 'start' : parseFloat(x) > 70 ? 'end' : 'middle');
    text.textContent = dot.dataset.score;
    plot.setAttribute('aria-valuenow', index + 1);
    plot.setAttribute('aria-valuetext', dot.dataset.score);
    callout.setAttribute('visibility', 'visible');
  }
  function pick(event) {
    const bounds = plot.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width * 100;
    const distance = dot => Math.abs(parseFloat(dot.getAttribute('cx')) - x);
    show(dots.reduce((best, dot, i) => distance(dot) < distance(dots[best]) ? i : best, 0));
  }
  const hide = () => callout.setAttribute('visibility', 'hidden');
  plot.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') pick(event); });
  plot.addEventListener('pointerleave', () => { if (document.activeElement !== plot) hide(); });
  plot.addEventListener('click', event => { plot.focus({ preventScroll: true }); pick(event); });
  plot.addEventListener('focus', () => show(selected));
  plot.addEventListener('blur', hide);
  plot.addEventListener('keydown', event => {
    if (event.key === 'Escape') return hide();
    const steps = { ArrowLeft: selected - 1, ArrowDown: selected - 1, ArrowRight: selected + 1, ArrowUp: selected + 1, Home: 0, End: dots.length - 1 };
    if (!Object.hasOwn(steps, event.key)) return;
    event.preventDefault();
    show(Math.max(0, Math.min(dots.length - 1, steps[event.key])));
  });
}

export function renderClubStats(weeks) {
  const chart = gameweekChart(weeks, 'rank');
  const scored = weeks.filter(w => Number.isSafeInteger(w.points));
  if (!scored.length) return chart + `<p class="panel panel-copy">${t("No weekly scores have been saved for this season.")}</p>`;
  const scores = scored.map(w => w.points).sort((a, b) => a - b);
  const sum = values => values.reduce((total, n) => total + n, 0);
  const mean = values => sum(values) / values.length;
  const middle = Math.floor(scores.length / 2);
  const average = mean(scores);
  const recent = scored.slice(-5);
  const peers = scored.filter(w => Number.isFinite(w.divisionAverage));
  const bench = weeks.map(w => w.bench).filter(Number.isSafeInteger);
  const card = (title, count, rows) => `<section class="panel"><div class="panel-heading"><h2>${t(title)}</h2><small>${t("{0} saved", count)}</small></div><dl class="info-list">${rows.map(([label, value]) => `<div><dt>${t(label)}</dt><dd>${points(value)}</dd></div>`).join('')}</dl></section>`;
  return `${chart}${gameweekChart(weeks, 'points')}
    <div class="club-stat-grid">${card("Scoring", scores.length, [
      ["Avg / saved GW", average], ["Median score", (scores[middle] + scores[Math.floor((scores.length - 1) / 2)]) / 2],
      ["Best saved GW", scores.at(-1)], ["Lowest score", scores[0]], ["Recent average", mean(recent.map(w => w.points))],
      ["Score variation (SD)", Math.sqrt(mean(scores.map(n => (n - average) ** 2)))]
    ])}${peers.length ? card("Against the division", peers.length, [
      ["Weeks above average", peers.filter(w => w.points > w.divisionAverage).length],
      ["Weekly top scores (incl. ties)", peers.filter(w => w.points === w.topScore).length],
      ["Avg points above division", mean(peers.map(w => w.points - w.divisionAverage))]
    ]) : ''}${bench.length ? card("Bench", bench.length, [
      ["Total bench points", sum(bench)], ["Avg bench points", mean(bench)], ["Most bench points", Math.max(...bench)]
    ]) : ''}</div>`;
}

export function clubTabs(href, section, historical, count) {
  const tabs = [['overview', 'Overview'], ['stats', 'Stats']];
  if (!historical) tabs.push(['transfers', 'Transfers']);
  const active = tabs.some(([key]) => key === section) ? section : 'overview';
  return `<nav class="section-nav" aria-label="${t("Club sections")}">${tabs.map(([key, label]) =>
    `<a${key === 'transfers' ? ' id="transfer-shortcut"' : ''}${key === active ? ' aria-current="page"' : ''} href="${href}${key === 'overview' ? '' : '&section=' + key}">${t(label)}${key === 'transfers' && count != null ? ' (' + number(count) + ')' : ''}</a>`).join('')}</nav>`;
}

export function renderClubIdentity(team, key, competition, badge, seasonControl) {
  return `<div class="club-identity"><a class="club-back" href="${competition}" aria-label="${t("← League {0} standings", e(key))}"><span aria-hidden="true">←</span></a>
    <section class="team-hero">${badge(team, true)}<div><h1>${e(team.name)}</h1><p>${team.manager ? t("Managed by {0}", e(team.manager)) : t("Manager not recorded")}</p></div></section>${seasonControl}</div>`;
}

export function renderClubGameweeks(view) {
  return `<details class="panel club-gameweeks quiet-disclosure"><summary>${t("Gameweek results")} <span>${t("{0} saved", view.weeks.length)}</span></summary>${view.weeks.length ? `<div class="stats-table-scroll"><table><caption class="sr-only">${t("{0} gameweek results in {1}, {2}", e(view.brandTeam.name), leagueLabel(e(view.key)), e(view.season))}</caption><thead><tr><th scope="col">${t("GW")}</th><th scope="col" class="numeric">${t("Points")}</th><th scope="col" class="numeric">${t("Total")}</th><th scope="col" class="numeric">${t("Rank")}</th></tr></thead><tbody>${view.weeks.map(week => `<tr><td>${week.gameweek}</td><td class="numeric">${points(week.points)}</td><td class="numeric">${points(week.total)}</td><td class="numeric">${points(week.rank)}</td></tr>`).join('')}</tbody></table></div><p class="panel-copy">${t("Weekly rank is calculated from cumulative league points; tied totals share a rank.")}</p>` : `<p class="panel-copy">${t("No weekly scores have been saved for this season.")}</p>`}</details>`;
}

export function renderClubSeason(club, view, seasons, badge, section, href = clubRoute(club.key, view.season), count) {
  const scores = view.weeks.map(week => week.points).filter(Number.isSafeInteger);
  const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const best = scores.length ? Math.max(...scores) : null;
  const competition = view.historical ? historicalLeagueRoute(view.key, view.season) : `#league=${view.key}&tab=standings`;
  const seasonControl = `<div class="control-field club-season-control"><label for="club-season" class="sr-only">${t("Season")}</label><select id="club-season" data-club="${e(club.key)}">${seasons.map(season => `<option value="${e(season)}"${season === view.season ? ' selected' : ''}>${e(season)}</option>`).join('')}</select></div>`;
  const header = `${renderClubIdentity({ ...view.brandTeam, manager: club.manager }, view.key, competition, badge, seasonControl)}
    <div class="club-links"><a class="club-competition" href="${competition}">${leagueLabel(e(view.key))} <span aria-hidden="true">↗</span></a><span>${view.historical ? t("Standalone league · Completed season") : t("Current season")}</span></div>
    ${clubTabs(href, section, view.historical, count)}`;
  if (section === 'stats') return header + renderClubStats(view.weeks);
  if (section === 'transfers' && !view.historical) return header;
  return `${header}<div class="team-summary"><div><span>${view.historical ? t("Final position") : t("League position")}</span><strong>${points(view.team.rank)}<small> / ${view.league.teams.length}</small></strong></div><div><span>${t("Season points")}</span><strong>${points(view.team.total)}</strong></div><div><span>${t("Avg / saved GW")}</span><strong>${points(average)}</strong></div><div><span>${t("Best saved GW")}</span><strong class="accent">${points(best)}</strong></div></div>
    ${view.historical ? `${renderClubGameweeks(view)}<p class="archive-note">${t("Historical lineups, transfers and bench scores were not supplied.")}</p>` : ''}`;
}

export function renderHistoricalLeague(league, season, week, teamLink) {
  return `<div class="page-heading"><span class="eyebrow">${e(season)}${t(" · Standalone league")}</span><h1>${leagueLabel(e(league.key))}</h1><p>${t("These leagues were independent competitions. No promotion or relegation applied.")}</p></div>
    <section class="panel standings"><h2 class="sr-only">${week ? t("Gameweek {0}", week) : t("Final standings")}</h2><div class="history-control table-toolbar">${weekControl('historical-week', 'Standings', [...league.weeks].sort((a, b) => b - a), week, `<option value="0"${!week ? ' selected' : ''}>${t("Final table")}</option>`)}<p>${teamCount(league.teams.length)}</p></div><div class="standings-scroll" role="region" aria-label="${t("League {0} standings", e(league.key))}" tabindex="0"><table><caption class="sr-only">${leagueLabel(e(league.key))}, ${e(season)}, ${week ? t("Gameweek {0}", week) : t("Final standings")}</caption><thead><tr><th scope="col" class="rank-col">#</th><th scope="col">${t("Club")}</th><th scope="col" class="numeric">${gameweekLabel(week || 38)}</th><th scope="col" class="numeric">${t("Bench")}<span class="sr-only">${t(" points")}</span></th><th scope="col" class="numeric">PTS</th></tr></thead><tbody>${league.teams.map(team => `<tr${!week && team.rank === 1 ? ' class="trophy-row"' : ''}><td class="rank-col">${team.rank}${!week && team.rank === 1 ? '<span class="sr-only">${t("League champion")}</span>' : ''}</td><td>${teamLink(team, league.key, season)}</td><td class="numeric">${points(team.eventPoints)}</td><td class="numeric bench-cell">${points(teamBenchPoints(team, week || 38))}</td><td class="numeric points-cell">${points(team.total)}</td></tr>`).join('')}</tbody></table></div>${!week ? `<div class="table-foot"><div class="places-legend"><span class="trophy"><i class="legend-line"></i>${t("League champion")}</span></div><span>${t("Completed season")}</span></div>` : ''}${league.teams.length ? '' : `<p class="no-results" role="status">${t("No teams match your search.")}</p>`}</section>
    <div class="archive-sources">${league.sources.map(source => `<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(t(source.title))} ↗</a>`).join('')}</div>`;
}
