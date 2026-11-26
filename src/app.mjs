import { renderPlayer, renderPlayers } from './players.mjs';
import { bindWeekButtons, weekControl } from './gameweek.mjs';
import { escapeHtml as e, newestTransactionFirst, playerRoute, standingPlace } from './model.mjs';
import { renderLineup, renderPlayerAvatar, handleHeadshotError } from './lineup.mjs';
import { renderWelcome, renderStats, renderArchive, leagueEmblem } from './pages.mjs';
import { t, language, setLanguage, number, formatDate, leagueLabel, gameweekLabel, teamCount } from './locale.mjs';
import { combinedWeeklyRecords, documentedDivision, teamBenchPoints, leagueGameweek } from './stats.mjs';
import { bindScorePlot, clubTabs, clubWeeks, renderClubStats, clubForTeam, clubBrandTeam, clubRoute, historicalLeagueRoute, getClubSeason, getHistoricalLeague, renderClubGameweeks, renderClubIdentity, renderClubSeason, renderHistoricalLeague } from './clubs.mjs';

const app = document.querySelector('#app');
const handleImageError = event => {
  if (event.target?.matches?.('img.team-crest') || event.target?.matches?.('img.league-emblem')) event.target.remove();
  else handleHeadshotError(event);
};
app.addEventListener('error', handleImageError, true);
document.querySelector('#divisions').addEventListener('error', handleImageError, true);
const search = document.querySelector('#search');
const searchToggle = document.querySelector('#search-toggle');
const searchCancel = document.querySelector('#search-cancel');
const topbar = document.querySelector('#topbar');
const design = document.querySelector('#design');
function applyDesign() {
  document.documentElement.dataset.design = design.value;
  document.querySelector('meta[name="theme-color"]').content = design.selectedOptions[0].dataset.themeColor;
}
try {
  const saved = localStorage.getItem('pre-ftw-design');
  if ([...design.options].some(option => option.value === saved)) design.value = saved;
} catch { /* Storage can be unavailable in private browsing. */ }
applyDesign();
design.addEventListener('change', () => {
  applyDesign();
  try { localStorage.setItem('pre-ftw-design', design.value); } catch { /* Keep the selection for this visit. */ }
});
const languageButton = document.querySelector('#language-toggle');
const languageFlag = document.querySelector('#language-flag');
const languageIndicator = document.querySelector('#language-indicator');
const staticCopy = [...document.querySelectorAll('[data-i18n]')].flatMap(element => {
  const attributes = element.dataset.i18n.split(' ').filter(Boolean);
  return attributes.length ? attributes.map(attribute => [element, attribute, element.getAttribute(attribute)]) : [[element, null, element.textContent]];
});
let redraw = () => {};

function applyLanguage() {
  document.documentElement.lang = language;
  for (const [element, attribute, message] of staticCopy) {
    if (attribute) element.setAttribute(attribute, t(message));
    else element.textContent = t(message);
  }
  const english = language === 'en';
  const label = t(english ? 'Switch to Portuguese (Portugal)' : 'Switch to English');
  languageButton?.setAttribute('aria-label', label);
  languageButton?.setAttribute('title', label);
  languageFlag?.setAttribute('src', `./assets/flag-${english ? 'gb' : 'pt'}.svg`);
  if (languageIndicator) languageIndicator.textContent = english ? 'EN' : 'PT';
}

applyLanguage();
if (languageButton) languageButton.hidden = false;
languageButton?.addEventListener('click', () => {
  setLanguage(language === 'en' ? 'pt-PT' : 'en');
  applyLanguage();
  redraw();
});

let playerData, loadingPlayers;
let config, latest, documented = {}, community = { seasons: [], documents: [] }, query = '', lastLeague = 'A', nextRouteFocus;

function setSearchOpen(open) {
  topbar?.classList.toggle('search-open', open);
  searchToggle?.setAttribute('aria-expanded', String(open));
}

function closeSearch(restoreFocus = false) {
  query = '';
  search.value = '';
  setSearchOpen(false);
  if (restoreFocus) {
    render();
    (searchToggle?.getClientRects().length ? searchToggle : search).focus();
  }
}
const navIcons = {
  home: 'M3 10 12 3l9 7v10H15v-6H9v6H3Z',
  leagues: 'M8 3h8v5a4 4 0 0 1-8 0Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v7m-4 2h8',
  stats: 'M4 20V10h4v10m4 0V4h4v16m4 0v-7M2 20h20',
  players: 'M16 21v-2a6 6 0 0 0-12 0v2m10-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0m3-2a4 4 0 0 1 0 7m2 3a5 5 0 0 1 2 4v2',
  archive: 'M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4Zm10 3a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2'
};
const tabs = [['standings', 'Table'], ['teams', 'Teams'], ['transactions', 'Transfers'], ['history', 'History']];
const transferOrders = {
  latest: { label: 'Latest' },
  points: { label: 'Highest season points', score: row => -Math.max(row.playerInPoints ?? -Infinity, row.playerOutPoints ?? -Infinity) },
  rank: { label: 'Best draft rank', score: row => Math.min(row.playerInDraftRank ?? Infinity, row.playerOutDraftRank ?? Infinity) }
};
const date = value => value ? formatDate(value) : t("Sample provided by the league");
const hasTeamId = team => Number.isSafeInteger(team.id) && team.id > 0;
const badge = (team, large = false) => `<span class="team-badge color-${(team.id ?? 0) % 4}${large ? ' large' : ''}" aria-hidden="true"><span class="team-initials">${e(team.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(''))}</span>${hasTeamId(team) ? `<img class="team-crest" src="./assets/crest/thumbs/${team.id}.webp" alt="" width="${large ? 72 : 32}" height="${large ? 82 : 37}" loading="lazy" decoding="async">` : ''}</span>`;
const route = (league, team = '', tab = 'overview') => `#${new URLSearchParams({ league, ...(team ? { team } : {}), tab })}`;
const leagueTransfersRoute = key => route(key, '', 'transactions');
const hashParams = () => new URLSearchParams(location.hash.slice(1));
const clubSnapshot = () => ({ ...latest, divisions: { ...documented, ...latest.divisions } });
const clubSeasons = club => [config.season, ...(community.seasons ?? []).map(row => row.season)].filter(season => getClubSeason(community, clubSnapshot(), club, season));
function bindRouteSelect(id, href) {
  bindWeekButtons(id);
  document.querySelector(`#${id}`)?.addEventListener('change', event => {
    nextRouteFocus = id;
    location.hash = href(event.target.value);
  });
}
function bindClubSeason(club) {
  if (club) bindRouteSelect('club-season', season => clubRoute(club.key, season) + (state().section === 'stats' ? '&section=stats' : ''));
}
function state() {
  const params = hashParams();
  const page = ['home', 'stats', 'archive', 'club', 'competition', 'player', 'players'].includes(params.get('page')) ? params.get('page') : params.has('league') ? 'league' : 'home';
  return { page, clubKey: params.get('club'), competitionKey: params.get('league'), season: [config.season, ...(community.seasons ?? []).map(row => row.season)].includes(params.get('season')) ? params.get('season') : config.season, week: Number(params.get('gw')), key: /^[A-D]$/.test(params.get('league')) ? params.get('league') : 'D', teamId: Number(params.get('team')), tab: tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'standings', section: params.get('section') };
}
const movement = team => {
  if (!team.lastRank) return `<span class="movement unchanged" aria-label="${t("Previous rank unavailable")}">–</span>`;
  const change = team.lastRank ? team.lastRank - team.rank : 0;
  return change ? `<span class="movement ${change > 0 ? 'up' : 'down'}" aria-label="${change > 0 ? t("Up {0} places", Math.abs(change)) : t("Down {0} places", Math.abs(change))}">${change > 0 ? '↑' : '↓'} ${Math.abs(change)}</span>` : `<span class="movement unchanged" aria-label="${t("No rank change")}">–</span>`;
};
const empty = (title, description, icon = '◌') => `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span><h2>${e(title)}</h2><p>${e(description)}</p></div>`;
function teamHref(team, key, season = config.season) {
  const club = clubForTeam(community, team, season);
  return club ? clubRoute(club.key, season) : hasTeamId(team) && season === config.season ? route(key, team.id) : null;
}
function clubTransfersRoute(href) {
  const params = new URLSearchParams(href.slice(1));
  params.set('season', config.season);
  params.set('section', 'transfers');
  return `#${params}`;
}
function teamLink(team, key, season = config.season, detail) {
  const href = teamHref(team, key, season);
  const brand = clubBrandTeam(community, clubSnapshot(), team, season);
  return `<${href ? `a href="${href}"` : 'span'} class="team-link">${teamIdentity(brand, detail)}</${href ? 'a' : 'span'}>`;
}
const teamIdentity = (team, detail = team.manager) => `${badge(team)}<span><strong>${e(team.name)}</strong><small>${e(detail)}</small></span>`;
const filtered = (teams, season = config.season) => teams.filter(team => `${team.name} ${team.manager} ${clubBrandTeam(community, clubSnapshot(), team, season).name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
const places = {
  trophy: { label: 'PRE FTW trophy' },
  promotion: { label: 'Promotion' },
  relegation: { label: 'Relegation' }
};

function table(league, key, heading = t("Standings"), toolbar = '') {
  const teams = filtered(league.teams);
  const legend = key === 'A' ? ['trophy', 'relegation'] : key === 'D' ? ['promotion'] : ['promotion', 'relegation'];
  return `<section class="panel standings">${toolbar ? `<h2 class="sr-only">${e(heading)}</h2>${toolbar}` : `<div class="panel-heading current-standings-heading"><h2>${e(heading)}</h2><span class="subtle-label">${t("Total points")}</span></div>`}
    <div class="standings-scroll" role="region" aria-label="${t("League {0} standings", key)}" tabindex="0"><table><caption class="sr-only">${t("League {0} standings. Select a team to view its squad.", key)}</caption><thead><tr><th scope="col" class="rank-col">#</th><th scope="col">${t("Team")}</th><th scope="col" class="numeric">${t("GW")}<span class="sr-only">${t(" points")}</span></th><th scope="col" class="numeric">${t("Bench")}<span class="sr-only">${t(" points")}</span></th><th scope="col" class="numeric total-col">PTS<span class="sr-only">${t(" total")}</span></th></tr></thead>
    <tbody>${teams.map(team => {
      const place = standingPlace(key, league.teams.indexOf(team) + 1, league.teams.length);
      const status = place ? `<span class="sr-only">${t("{0} place", t(places[place].label))}</span>` : '';
      return `<tr${place ? ` class="${place}-row"` : ''}><td class="rank-col"><span class="rank-number">${team.rank}</span>${status}${movement(team)}</td><td>${teamLink(team, key)}</td><td class="numeric gw-cell">${number(team.eventPoints)}</td><td class="numeric bench-cell">${number(teamBenchPoints(team, league.gameweek))}</td><td class="numeric points-cell">${number(team.total)}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${teams.length ? '' : `<p class="no-results" role="status">${t("No teams match your search.")}</p>`}
    <div class="table-foot"><div class="places-legend">${legend.map(place => `<span class="${place}"><i class="legend-line"></i>${t(places[place].label)}</span>`).join('')}</div><span>${t("Places for next season · GW / Bench = gameweek points · — = unavailable")}</span></div></section>`;
}

function rail(league, key) {
  const weekly = [...league.teams].sort((a, b) => b.eventPoints - a.eventPoints);
  const best = weekly[0], leader = league.teams[0];
  const average = league.teams.length ? league.teams.reduce((sum, team) => sum + team.eventPoints, 0) / league.teams.length : 0;
  return `<aside class="insights" aria-label="${t("League highlights")}"><section class="panel weekly"><div class="panel-heading"><h2>${t("This gameweek")}</h2><span class="tiny-accent">${league.gameweek ? gameweekLabel(league.gameweek) : t("LATEST")}</span></div>
    ${best ? `<div class="weekly-best"><span class="eyebrow">${t("TOP SCORER")}${weekly.filter(t => t.eventPoints === best.eventPoints).length > 1 ? t(" · JOINT") : ''}</span>${teamLink(best, key)}<div class="big-score">${number(best.eventPoints)}<span>${t("points")}</span></div></div><div class="weekly-average"><span>${t("Division average")}</span><strong>${number(average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <small>pts</small></strong></div>` : `<p class="panel-copy">${t("Waiting for the first scores.")}</p>`}</section>
    <section class="panel race"><div class="panel-heading"><h2>${t("At the top")}</h2><span aria-hidden="true">↗</span></div>${leader ? `<div class="race-body">${teamLink(leader, key)}<p><strong>${number(leader.total)}</strong>${t(" season points")}</p>${league.teams[1] ? `<div class="lead-gap"><span class="accent">+${number(leader.total - league.teams[1].total)}</span><span>${t("ahead of second place")}</span></div>` : ''}</div>` : ''}</section>
    </aside>`;
}

function transferView(league, team, params) {
  const all = team ? league.transactions.filter(row => row.teamId === team.id) : league.transactions;
  const weeks = [...new Set(all.map(row => row.gameweek))].sort((a, b) => b - a).map(String);
  const clubs = team ? [] : league.teams.filter(hasTeamId);
  const week = weeks.includes(params.get('gw')) ? params.get('gw') : '';
  const club = clubs.find(owner => String(owner.id) === params.get('club'));
  const requested = params.get('sort');
  const order = Object.hasOwn(transferOrders, requested) ? requested : 'latest';
  const { score } = transferOrders[order];
  const rows = all.filter(row => (!week || String(row.gameweek) === week) && (!club || row.teamId === club.id));
  rows.sort((a, b) => (score ? score(a) - score(b) : 0) || newestTransactionFirst(a, b));
  return { rows, total: all.length, weeks, clubs, week, club, order };
}

const transferCount = ({ rows, total }) => total === 1
  ? t("{0} of {1} move", rows.length, total)
  : t("{0} of {1} moves", rows.length, total);
function transferSelect(id, label, options, selected) {
  return `<div class="control-field"><label for="${id}">${e(label)}</label><select id="${id}">${options.map(([value, name]) => `<option value="${value}"${value === selected ? ' selected' : ''}>${e(name)}</option>`).join('')}</select></div>`;
}

function transferRow(row, owner, key, order) {
  const { score } = transferOrders[order];
  const rank = order === 'rank';
  const href = owner && teamHref(owner, key);
  const players = [
    { direction: 'In', id: row.playerInId, name: row.playerIn, photo: row.playerInPhotoCode, points: row.playerInPoints, rank: row.playerInDraftRank },
    { direction: 'Out', id: row.playerOutId, name: row.playerOut, photo: row.playerOutPhotoCode, points: row.playerOutPoints, rank: row.playerOutDraftRank }
  ];
  const playerLines = players.map(player => {
    const value = rank ? player.rank : player.points;
    const best = score && value != null && (rank ? value : -value) === score(row);
    const metric = value == null ? '—' : rank ? `#${number(value)}` : t("{0} pts", number(value));
    const link = playerRoute(player.id, player.photo, key);
    const tag = link ? 'a' : 'div';
    return `<${tag} class="transfer-player"${link ? ` href="${link}"` : ''}><b class="${player.direction === 'In' ? 'accent' : 'muted'}">${t(player.direction)}</b>${renderPlayerAvatar(player.photo)}<strong>${e(player.name)}</strong><span class="transfer-value${best ? ' accent' : ''}">${metric}</span></${tag}>`;
  }).join('');
  const details = players.map(player => {
    const link = playerRoute(player.id, player.photo, key);
    return `<div><strong>${link ? `<a href="${link}">${e(player.name)}</a>` : e(player.name)}</strong><span>${t("Season FPL points {0} · Draft rank {1}", player.points == null ? '—' : t("{0} pts", number(player.points)), player.rank == null ? '—' : `#${number(player.rank)}`)}</span></div>`;
  }).join('');
  return `<li class="transfer-row"><div class="transfer-move">
    <div class="transfer-meta">${href ? `<a class="transfer-club" href="${clubTransfersRoute(href)}">${badge(owner)}<span>${e(owner.name)}</span></a>` : ''}<p class="transfer-kind">${score ? `${gameweekLabel(row.gameweek)} · ` : ''}${e(t(row.kind))}</p></div>
    ${playerLines}</div><details class="transfer-details quiet-disclosure"><summary>${t("Player details")}</summary><div>${details}</div></details></li>`;
}

function transferResults(view, key, team, params) {
  if (!view.total) return `<p class="panel-copy">${t("No completed transfers.")}</p>`;
  if (!view.rows.length) {
    const clear = new URLSearchParams(params);
    clear.delete('gw');
    if (!team) clear.delete('club');
    return `<p class="panel-copy">${t("No transfers match these filters.")} <a class="transfer-link" href="#${clear}">${t("Clear filters")}</a></p>`;
  }
  const owners = new Map(view.clubs.map(owner => [owner.id, owner]));
  const renderRow = row => transferRow(row, owners.get(row.teamId), key, view.order);
  const { score } = transferOrders[view.order];
  if (score) return `<ol class="transfer-list" role="list">${view.rows.map(renderRow).join('')}</ol>`;
  const groups = new Map();
  for (const row of view.rows) {
    if (!groups.has(row.gameweek)) groups.set(row.gameweek, []);
    groups.get(row.gameweek).push(row);
  }
  return [...groups].map(([week, rows]) => `<h3 class="transfer-week" id="transfer-gw-${week}">${t("Gameweek {0}", week)}<span>${rows.length === 1 ? t("1 move") : t("{0} moves", rows.length)}</span></h3><ul class="transfer-list" aria-labelledby="transfer-gw-${week}" role="list">${rows.map(renderRow).join('')}</ul>`).join('');
}

const activeTransferFilters = view => [view.club?.name, view.order === 'latest' ? '' : t(transferOrders[view.order].label)].filter(Boolean).join(' · ');
const transferMetric = view => view.rows.length ? (view.order === 'rank' ? t("Draft rank (1 is best)") : t("Season FPL points")) + (view.order !== 'latest' ? t(" · Either player can determine the order.") : '') : '';

function transactions(league, key, team = null, clubName = team?.name) {
  const params = hashParams();
  const view = Array.isArray(league?.transactions) ? transferView(league, team, params) : null;
  const active = view ? activeTransferFilters(view) : '';
  const controls = view?.total ? `<div class="history-control transfer-controls${team ? ' transfer-controls-club' : ''}">
     ${weekControl('transfer-week', 'Gameweek', view.weeks, view.week, `<option value="">${t("All weeks")}</option>`)}
    <details id="transfer-filters" class="transfer-filters quiet-disclosure"><summary>${t("Filters")}</summary><div class="transfer-filter-fields">
      ${team ? '' : transferSelect('transfer-club', t("Club"), [['', t("All clubs")], ...view.clubs.map(club => [String(club.id), club.name])], String(view.club?.id ?? ''))}
      ${transferSelect('transfer-order', t("Sort by"), Object.entries(transferOrders).map(([value, { label }]) => [value, t(label)]), view.order)}
    </div></details></div><div id="transfer-active" class="transfer-active"${active || view.week ? '' : ' hidden'}><span id="transfer-active-label">${e(active)}</span><button id="transfer-reset" type="button">${t("Reset filters")}</button></div>` : '';
  return `<section id="transfer-panel" class="panel ${team ? 'club-transfer-panel' : 'league-transfer-panel'}" aria-labelledby="transfer-heading"><div class="panel-heading transfer-heading-row"><h2 id="transfer-heading" tabindex="-1">${team ? t("{0} transfers", e(clubName)) : t("League transfers")}</h2></div>
    ${team ? `<a class="transfer-link transfer-league-link" href="${leagueTransfersRoute(key)}">${t("League {0} transfers", key)}</a>` : ''}
    ${view && (league.transactionsStale || league.stale) ? `<p class="panel-copy">${t("Showing saved transfers. The last transfer sync failed.")}</p>` : ''}
    ${controls}${view ? `<div class="transfer-context"><span id="transfer-metric">${transferMetric(view)}</span><span id="transfer-count" role="status" aria-atomic="true">${transferCount(view)}</span></div>` : ''}
    <div id="transfer-results">${view ? transferResults(view, key, team, params) : `<p class="panel-copy"><strong>${t("Transfers unavailable.")}</strong> ${t("Completed moves will appear after a successful sync.")}</p>`}</div></section>`;
}

function teamPage(league, team, current) {
  const club = clubForTeam(community, team, config.season);
  const view = club && getClubSeason(community, clubSnapshot(), club, config.season);
  const clubName = view?.brandTeam.name ?? team.name;
  const href = current.page === 'club' ? clubRoute(current.clubKey, config.season) : route(current.key, team.id) + "&season=" + encodeURIComponent(config.season);
  const count = Array.isArray(league.transactions) ? league.transactions.filter(row => row.teamId === team.id).length : null;
  const competition = route(current.key, '', 'standings');
  const header = view ? renderClubSeason(club, { ...view, league, team }, clubSeasons(club), badge, current.section, href, count) : `${renderClubIdentity(team, current.key, competition, badge, `<span class="club-fixed-season">${e(config.season)}</span>`)}<div class="club-links"><a class="club-competition" href="${competition}">${leagueLabel(current.key)} <span aria-hidden="true">↗</span></a></div>${clubTabs(href, current.section, false, count)}${['transfers', 'stats'].includes(current.section) ? '' : `
    <div class="team-summary"><div><span>${t("League position")}</span><strong>${team.rank}<small> / ${league.teams.length}</small></strong></div><div><span>${t("Season points")}</span><strong>${number(team.total)}</strong></div><div><span>${league.gameweek ? t("Gameweek {0}", league.gameweek) : t("Latest gameweek")}</span><strong class="accent">${number(team.eventPoints)}</strong></div><div><span>${t("Waiver priority")}</span><strong>${number(team.waiverPick)}</strong></div></div>`}`;
  if (current.section === 'transfers') return header + transactions(league, current.key, team, clubName);
  if (current.section === 'stats') return view ? header : header + renderClubStats(clubWeeks(combinedWeeklyRecords(latest, community, config.season), current.key, team));
  return `${header}
    <div class="content-grid team-content"><div>${renderLineup(team, current.key, latest.pitchRoles?.byCode)}${view ? renderClubGameweeks(view) : ''}</div><aside class="insights"><section class="panel"><div class="panel-heading"><h2>${t("Team info")}</h2></div><dl class="info-list"><div><dt>${t("Manager")}</dt><dd>${e(team.manager)}</dd></div><div><dt>${t("Division")}</dt><dd>${leagueLabel(current.key)}</dd></div>${hasTeamId(team) ? `<div><dt>${t("Team ID")}</dt><dd>${team.id}</dd></div>` : ''}<div><dt>${t("Waiver priority")}</dt><dd>${number(team.waiverPick)}</dd></div><div><dt>${t("Movement")}</dt><dd>${movement(team)}</dd></div></dl></section><details class="quiet-disclosure score-notes"><summary>${t("Points that count")}</summary><p>${t("Standings use official team totals. Individual player points include the bench and are shown separately.")}</p></details></aside></div>`;
}

function focusTeamTransfers() {
  const { page, teamId, section } = state();
  if (section !== 'transfers' || (page !== 'club' && !(page === 'league' && teamId))) return false;
  const heading = document.querySelector('#transfer-heading');
  if (!heading) return false;
  heading.focus({ preventScroll: true });
  window.scrollTo?.(0, 0);
  return true;
}

function bindTransferControls(league, key, team) {
  document.querySelector('#transfer-shortcut')?.addEventListener('click', event => {
    if (focusTeamTransfers()) event.preventDefault();
  });
  if (!league?.transactions?.length) return;
  const syncWeekButtons = bindWeekButtons('transfer-week');
  const fields = [['transfer-week', 'gw'], ...(!team ? [['transfer-club', 'club']] : []), ['transfer-order', 'sort']];
  function update(params) {
    const view = transferView(league, team, params);
    history.replaceState(history.state, '', `#${params}`);
    document.querySelector('#transfer-count').textContent = transferCount(view);
    document.querySelector('#transfer-metric').textContent = transferMetric(view);
    document.querySelector('#transfer-results').innerHTML = transferResults(view, key, team, params);
    const active = activeTransferFilters(view);
    document.querySelector('#transfer-active-label').textContent = active;
    document.querySelector('#transfer-active').hidden = !active && !view.week;
  }
  for (const [id, param] of fields) {
    document.querySelector(`#${id}`)?.addEventListener('change', event => {
      const params = hashParams();
      if (event.target.value) params.set(param, event.target.value);
      else params.delete(param);
      update(params);
    });
  }
  document.querySelector('#transfer-reset')?.addEventListener('click', () => {
    const params = hashParams();
    for (const [id, param] of fields) {
      params.delete(param);
      document.querySelector(`#${id}`).value = param === 'sort' ? 'latest' : '';
    }
    update(params);
    syncWeekButtons?.();
    document.querySelector('#transfer-week').focus();
  });
}

function historyView(history, key, status, notice) {
  const { weeks, gameweek, league } = history;
  const selector = weeks.length ? weekControl('league-gameweek', 'Gameweek', weeks, gameweek, league ? '' : `<option value="" selected disabled>${t("Choose a gameweek")}</option>`) : '';
  const toolbar = `<h2 class="sr-only">${t("Gameweek history")}</h2><div class="history-control table-toolbar">${selector}<p><span>${e(config.season)} · ${status}</span>${league?.source === 'documentation' ? ` · <a href="${e(league.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("community journal")} ↗</a>` : ''}</p></div>${notice}`;
  return league ? `${table(league, key, t("Standings at GW {0}", gameweek), toolbar)}<p class="panel-copy">${t("Positions use cumulative points at the selected gameweek. GW and Bench show points for that week; unavailable scores remain a dash.")}</p>` : `<section class="panel">${toolbar}${empty(weeks.length ? t("Gameweek unavailable") : t("No gameweeks saved yet"), weeks.length ? t("No scores were recorded for this gameweek. Choose an available gameweek above.") : t("Gameweek standings will appear after scores are saved."))}</section>`;
}

function searchResults() {
  const snapshot = clubSnapshot();
  const matches = config.divisions.flatMap(({ key }) => filtered(snapshot.divisions[key]?.teams ?? []).map(team => ({ team, key, season: config.season })));
  for (const club of community.clubs ?? []) {
    if (getClubSeason(community, snapshot, club, config.season)) continue;
    const view = (community.seasons ?? []).map(({ season }) => getClubSeason(community, snapshot, club, season)).find(Boolean);
    if (view && filtered([view.team], view.season).length) matches.push(view);
  }
  return `<div class="page-heading"><h1>${t("Search clubs")}</h1><p role="status">${t("{0} results across all leagues", matches.length)}</p></div><section class="panel">${matches.length ? `<ul class="identity-list" role="list">${matches.map(({ team, key, season }) => {
    return `<li class="identity-row">${teamLink(team, key, season)}<a class="identity-competition" href="${season === config.season ? route(key) : historicalLeagueRoute(key, season)}" aria-label="${t("View {0}, {1}", leagueLabel(e(key)), e(season))}">${leagueLabel(e(key))} &middot; ${e(season)}</a></li>`;
  }).join('')}</ul>` : `<p class="no-results" role="status">${t("No clubs match your search.")}</p>`}</section>`;
}

function teamRows(league, key) {
  const teams = filtered(league.teams);
  return `<section class="panel identity-list">${teams.length ? teams.map(team => {
    const href = teamHref(team, key);
    const brand = clubBrandTeam(community, clubSnapshot(), team, config.season);
    return `<${href ? `a href="${href}"` : 'article'} class="identity-row"><span class="team-link">${teamIdentity(brand)}</span><span class="identity-value"><strong>${number(team.total)} <small>pts</small></strong><small>${t("#{0} in League {1}", team.rank, key)}</small>${href ? '' : `<small>${t("Squad awaits league ID")}</small>`}</span></${href ? 'a' : 'article'}>`;
  }).join('') : empty(t("No matching teams"), t("Try a different team or manager name."))}</section>`;
}

const translateWarning = warning => {
  const squad = /^(.*)'s squad is unavailable\.$/.exec(warning);
  return squad ? t("{0}'s squad is unavailable.", squad[1]) : t(warning);
};

function render() {
  const current = state();
  const leagueTransfers = current.page === 'league' && !current.teamId && current.tab === 'transactions';
  const divisionHref = key => leagueTransfers ? leagueTransfersRoute(key) : route(key);
  document.querySelector('#main').setAttribute('data-page', current.page === 'league' && current.teamId ? 'club' : current.page);
  if (['league', 'player'].includes(current.page) || (current.page === 'players' && current.key === hashParams().get('league'))) lastLeague = current.key;
  else if (current.page === 'club') {
    const club = (community.clubs ?? []).find(club => club.key === current.clubKey);
    const view = club && getClubSeason(community, clubSnapshot(), club, config.season);
    if (view) lastLeague = view.key;
  }
  const selectedPage = current.page === 'player' ? 'players' : ['league', 'club', 'competition'].includes(current.page) ? 'leagues' : current.page;
  document.querySelector('#pages').innerHTML = [['home', 'Home'], ['leagues', 'Leagues'], ['players', 'Players'], ['stats', 'Stats'], ['archive', 'Records']].map(([page, label]) => `<a data-nav="${page}" href="${page === 'leagues' ? route(lastLeague) : `#page=${page}`}"${selectedPage === page ? ' aria-current="page"' : ''}><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${navIcons[page]}"></path></svg><span>${t(label)}</span></a>`).join('');
  document.querySelector('#divisions').innerHTML = config.divisions.map(d => `<a class="division-link${current.page === 'league' && d.key === current.key ? ' selected' : ''}" href="${divisionHref(d.key)}"${current.page === 'league' && d.key === current.key ? ' aria-current="page"' : ''}>${leagueEmblem(d.key)}<span>${leagueLabel(d.key)}</span><span class="division-chevron" aria-hidden="true">›</span></a>`).join('');
  if (query) {
    app.innerHTML = searchResults();
    document.title = `${t("Search clubs")} · PRE FTW League`;
    app.setAttribute('aria-busy', 'false');
    return;
  }
  if (current.page === 'player' || current.page === 'players') {
    if (!playerData) {
      app.innerHTML = `<p class="loading" role="status">${t("Loading player…")}</p>`;
      app.setAttribute('aria-busy', 'true');
      if (!loadingPlayers) loadingPlayers = fetch('./data/players.json', { cache: 'no-cache' }).then(async response => {
        if (!response.ok) throw new Error('Player data unavailable');
        const data = await response.json();
        if (data.season !== config.season) throw new Error('Player season mismatch');
        playerData = data;
        if (['player', 'players'].includes(state().page)) render();
      }).catch(() => {
        if (!['player', 'players'].includes(state().page) || query) return;
        app.innerHTML = `<p class="no-results">${t("Player data unavailable")}</p><button class="retry-button" id="retry">${t("Try again")}</button>`;
        app.setAttribute('aria-busy', 'false');
        document.querySelector('#retry').addEventListener('click', render);
      }).finally(() => { loadingPlayers = null; });
      return;
    }
    const params = hashParams();
    const profile = current.page === 'players' ? renderPlayers(playerData, latest, config, params, current.key, badge) : renderPlayer(playerData, latest, config, params, current.key, teamLink);
    app.innerHTML = profile.html;
    document.title = `${profile.name} · PRE FTW League`;
    app.setAttribute('aria-busy', 'false');
    for (const [id, field] of [['player-league', 'league'], ['player-metric', 'metric']]) {
      bindRouteSelect(id, value => {
        params.set(field, value);
        params.delete('p');
        if (field === 'league') params.delete('team');
        return `#${params}`;
      });
    }
    document.querySelector('#find-player')?.addEventListener('submit', event => {
      event.preventDefault();
      const term = new FormData(event.currentTarget).get('q').trim();
      if (term) params.set('q', term); else params.delete('q');
      params.delete('p');
      location.hash = `#${params}`;
    });
    return;
  }
  if (current.page === 'club' || current.page === 'competition') {
    if (current.page === 'club') {
      const club = (community.clubs ?? []).find(club => club.key === current.clubKey);
      const view = club && getClubSeason(community, clubSnapshot(), club, current.season);
      let content;
      if (!view) content = `<section class="panel">${empty(t("Club season not found"), t("This club has no recorded participation in the selected season."))}</section>`;
      else if (view.historical) content = renderClubSeason(club, view, clubSeasons(club), badge, current.section);
      else {
        const source = view.league.source === 'provided' ? t("League-provided sample") : view.league.updatedAt ? t("Standings updated {0}", date(view.league.updatedAt)) : t("Published GW {0} standings", view.league.gameweek);
        content = teamPage(view.league, view.team, { ...current, key: view.key }) + `<p class="archive-note">${source}${view.league.stale ? t(" · Last refresh failed") : ''}</p>`;
      }
      app.innerHTML = content;
      bindClubSeason(club);
      if (current.section === 'stats') bindScorePlot();
      if (view && !view.historical) bindTransferControls(view.league, view.key, view.team);
      document.title = `${view?.brandTeam.name ?? t("Club season")} · PRE FTW League`;
    } else {
      const league = getHistoricalLeague(community, current.season, current.competitionKey, current.week);
      app.innerHTML = league ? renderHistoricalLeague({ ...league, teams: filtered(league.teams, current.season) }, current.season, current.week, teamLink) : `<section class="panel">${empty(t("Competition not found"), t("Choose a recorded competition from a club’s season page."))}</section>`;
      bindRouteSelect('historical-week', week => historicalLeagueRoute(current.competitionKey, current.season, Number(week)));
      document.title = `${league ? leagueLabel(league.key) : t("Competition")} · ${current.season} · PRE FTW League`;
    }
    app.setAttribute('aria-busy', 'false');
    return;
  }
  if (current.page !== 'league') {
    app.innerHTML = current.page === 'stats' ? renderStats(config, latest, current.week, teamLink, community, current.season) : current.page === 'archive' ? renderArchive(community, teamLink, clubSnapshot()) : renderWelcome(config, { divisions: { ...documented, ...latest.divisions } });
    document.title = `${t(current.page === 'stats' ? 'Gameweek stats' : current.page === 'archive' ? 'Record book' : 'Welcome')} · PRE FTW League`;
    app.setAttribute('aria-busy', 'false');
    bindRouteSelect('stats-season', season => `#${new URLSearchParams({ page: 'stats', season })}`);
    bindRouteSelect('gameweek', gw => `#${new URLSearchParams({ page: 'stats', season: current.season, gw })}`);
    return;
  }
  const division = config.divisions.find(d => d.key === current.key);
  const history = current.tab === 'history' && !current.teamId ? leagueGameweek(latest, community, current.key, config.season, current.week) : null;
  const league = history ? history.league : latest.divisions[current.key] ?? documented[current.key];
  const team = current.teamId ? league?.teams.find(t => t.id === current.teamId) : null;
  const refreshFailed = !history && (latest.errors ?? []).some(error => error.startsWith(`League ${current.key} `));
  const status = history ? (league ? t("GW {0} standings", league.gameweek) : t("No gameweek standings")) : !league ? (refreshFailed ? t("Sync failed") : t("Awaiting data")) : league.source === 'documentation' ? t("Published GW {0}", league.gameweek) : league.source === 'provided' ? t("Sample standings") : league.stale ? t("Saved standings · refresh failed") : t("Saved standings");
  const freshEnough = league?.updatedAt && Date.now() - Date.parse(league.updatedAt) < 48 * 60 * 60 * 1000;
  const oldNotice = league?.source === 'api' && !freshEnough ? `<p class="notice">${t("These standings are more than 48 hours old. Displaying the last saved data.")}</p>` : '';
  const notice = league?.source === 'documentation' ? `<p class="notice">${t("Published GW {0} standings from the {1}.", league.gameweek, `<a href="${e(league.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t("community journal")}</a>`)}${history ? '' : division.leagueId ? t(" Automatic squads and transactions await a successful API sync.") : t(" Automatic squads and transactions await the league ID.")}</p>` : league?.source === 'provided' ? `<p class="notice"><span aria-hidden="true">◷</span> ${t("Supplied league standings")} · ${league.stale ? t("Last refresh failed; sample preserved.") : t("Automatic updates have not run yet.")}</p>` : (league?.stale || refreshFailed) ? `<p class="notice">${t("The last refresh failed. Any previous standings have been preserved.")}</p>` : oldNotice;
  const count = league ? teamCount(league.teams.length) : t("Awaiting standings");
  const top = `<section class="competition-hero league-hero">${leagueEmblem(current.key)}<div class="league-identity"><h1>${leagueLabel(current.key)}</h1><select id="league-division" class="league-division" aria-label="${t("Choose a division")}">${config.divisions.map(d => `<option value="${e(divisionHref(d.key))}"${d.key === current.key ? ' selected' : ''}>${leagueLabel(d.key)}</option>`).join('')}</select><span class="eyebrow">PRE FTW &middot; ${e(config.season)}</span></div><div class="league-meta"><span>${count}</span><span class="data-status"><i></i>${status}</span></div></section>`;
  const nav = `<nav class="section-nav" aria-label="${t("League sections")}">${tabs.map(([key, label]) => `<a href="${route(current.key, '', key)}"${current.tab === key ? ' aria-current="page"' : ''}>${t(label)}</a>`).join('')}</nav>`;
  const metadata = !history && !leagueTransfers && !team && league ? `<p class="league-context">${count} · ${status}</p>` : '';
  let content;
  if (current.teamId && !team) content = `<section class="panel">${empty(t("Team not found"), t("Choose a team from this division’s standings."))}<a class="empty-back" href="${route(current.key)}">${t("Back to League {0} →", current.key)}</a></section>`;
  else if (team) content = teamPage(league, team, current);
  else if (history) content = historyView(history, current.key, status, league?.source === 'documentation' ? '' : notice);
  else if (leagueTransfers) content = transactions(league, current.key);
  else if (!league) content = `<section class="panel pending-division"><span class="pending-letter" aria-hidden="true">${current.key}</span>${empty(division.leagueId ? t("Ready for the first sync") : t("Another chapter is coming"), division.leagueId ? t("League {0} is configured. Its standings will appear after the first successful data refresh.", current.key) : t("League {0} will join the table once its league ID is added.", current.key))}<a class="empty-back" href="${route('D')}">${t("Explore League D →")}</a></section>`;
  else if (current.tab === 'teams') content = teamRows(league, current.key);
  else content = `<div class="content-grid"><div>${table(league, current.key)}<details class="about-league quiet-disclosure"><summary>${t("About this division")}</summary><p>${e(league.name)}${t(" · Classic total-points scoring. ")}${current.key === 'A' ? t("First place wins the PRE FTW League trophy. The bottom two teams move to League B.") : current.key === 'D' ? t("The top two teams move to League C. There is no relegation from League D.") : t("The top two teams move to League {0}. The bottom two move to League {1}.", current.key === 'B' ? 'A' : 'B', current.key === 'B' ? 'C' : 'D')}${t(" Highlighted places show the current season-end projection.")}</p></details></div>${rail(league, current.key)}</div>`;
  app.innerHTML = `${team ? '' : top + nav}${metadata}${history ? '' : notice}${content}<div class="update-footer"><span>${history ? (league ? t("Saved scores for GW {0}", league.gameweek) : t("No scores for this gameweek")) : league?.source === 'documentation' ? t("Source: community journal GW {0}", league.gameweek) : league?.updatedAt ? t("Standings updated {0}", date(league.updatedAt)) : league ? t("Source: league-provided sample · Sync pending") : t("No standings received yet")}</span><span>${history ? t("Gameweek history") : league?.source === 'documentation' ? t("Published report") : t("Updates three times a day")} · ${e(config.season)}</span></div>${league?.warnings?.length ? `<details class="sync-notes quiet-disclosure"><summary>${t("Data availability ({0})", league.warnings.length)}</summary><ul>${league.warnings.map(w => `<li>${e(translateWarning(w))}</li>`).join('')}</ul></details>` : ''}`;
  document.title = `${team ? team.name : leagueLabel(current.key)} · PRE FTW League`;
  app.setAttribute('aria-busy', 'false');
  if (team && current.section === 'stats') bindScorePlot();
  if (team) bindClubSeason(clubForTeam(community, team, config.season));
  if (team || leagueTransfers) bindTransferControls(league, current.key, team);
  bindRouteSelect('league-division', href => href);
  bindRouteSelect('league-gameweek', gw => `#${new URLSearchParams({ league: current.key, tab: 'history', gw })}`);
}

async function start() {
  const responses = await Promise.all(['./data/config.json', './data/latest.json'].map(path => fetch(path, { cache: 'no-cache' })));
  if (responses.some(response => !response.ok)) throw new Error('Data unavailable');
  [config, latest] = await Promise.all(responses.map(response => response.json()));
  community = await fetch('./data/community.json').then(response => response.ok ? response.json() : community).catch(() => community);
  documented = Object.fromEntries(config.divisions.map(division => [division.key, documentedDivision(community, division.key, config.season)]).filter(([, league]) => league));
  window.addEventListener('hashchange', () => {
    const focusId = nextRouteFocus;
    nextRouteFocus = null;
    closeSearch();
    render();
    if (!focusTeamTransfers()) (focusId && document.querySelector(`#${focusId}`) || document.querySelector('#main')).focus({ preventScroll: true });
  });
  searchToggle?.addEventListener('click', () => {
    setSearchOpen(true);
    search.focus();
  });
  searchCancel?.addEventListener('click', () => closeSearch(true));
  search.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeSearch(true);
  });
  search.addEventListener('input', () => {
    query = search.value.trim();
    if (query) setSearchOpen(true);
    render();
  });
  redraw = render;
  render();
  focusTeamTransfers();
}
function renderLoadError() {
  app.innerHTML = `<section class="panel">${empty(t("The league is taking a breather"), t("We could not load the saved standings. Please try again."))}<button id="retry" class="retry-button">${t("Try again")}</button></section>`;
  app.setAttribute('aria-busy', 'false');
  document.querySelector('#retry').addEventListener('click', () => location.reload());
}
start().catch(() => {
  redraw = renderLoadError;
  redraw();
});
