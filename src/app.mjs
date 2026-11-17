import { escapeHtml as e, standingPlace } from './model.mjs';
import { renderLineup, handleHeadshotError } from './lineup.mjs';
import { renderWelcome, renderStats, renderArchive, leagueEmblem } from './pages.mjs';
import { documentedDivision } from './stats.mjs';
import { clubForTeam, clubBrandTeam, clubRoute, historicalLeagueRoute, getClubSeason, getHistoricalLeague, renderClubSeason, renderHistoricalLeague } from './clubs.mjs';

const app = document.querySelector('#app');
const handleImageError = event => {
  if (event.target?.matches?.('img.team-crest') || event.target?.matches?.('img.league-emblem')) event.target.remove();
  else handleHeadshotError(event);
};
app.addEventListener('error', handleImageError, true);
document.querySelector('#divisions').addEventListener('error', handleImageError, true);
const search = document.querySelector('#search');
let config, latest, displayed, documented = {}, community = { seasons: [], documents: [] }, query = '', loadVersion = 0;
const tabs = ['Overview', 'Standings', 'Teams', 'Transactions', 'History'];
const number = value => value == null ? '—' : new Intl.NumberFormat('en-GB').format(value);
const date = value => value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sample provided by the league';
const hasTeamId = team => Number.isSafeInteger(team.id) && team.id > 0;
const badge = (team, large = false) => `<span class="team-badge color-${(team.id ?? 0) % 4}${large ? ' large' : ''}" aria-hidden="true"><span class="team-initials">${e(team.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(''))}</span>${hasTeamId(team) ? `<img class="team-crest" src="./assets/crest/thumbs/${team.id}.webp" alt="" width="${large ? 72 : 32}" height="${large ? 82 : 37}" loading="lazy" decoding="async">` : ''}</span>`;
const route = (league, team = '', tab = 'overview', snapshot = '') => `#${new URLSearchParams({ league, ...(team ? { team } : {}), tab, ...(snapshot ? { snapshot } : {}) })}`;
const clubSnapshot = () => ({ ...latest, divisions: { ...documented, ...latest.divisions } });
const clubSeasons = club => [config.season, ...(community.seasons ?? []).map(row => row.season)].filter(season => getClubSeason(community, clubSnapshot(), club, season));
function bindClubSeason(club) {
  if (club) document.querySelector('#club-season')?.addEventListener('change', event => { location.hash = clubRoute(club.key, event.target.value); });
}
function state() {
  const params = new URLSearchParams(location.hash.slice(1));
  const page = ['home', 'stats', 'archive', 'club', 'competition'].includes(params.get('page')) ? params.get('page') : params.has('league') ? 'league' : 'home';
  return { page, clubKey: params.get('club'), competitionKey: params.get('league'), season: [config.season, ...(community.seasons ?? []).map(row => row.season)].includes(params.get('season')) ? params.get('season') : config.season, week: Number(params.get('gw')), key: /^[A-D]$/.test(params.get('league')) ? params.get('league') : 'D', teamId: Number(params.get('team')), tab: tabs.map(t => t.toLowerCase()).includes(params.get('tab')) ? params.get('tab') : 'overview', snapshot: /^\d{4}-\d{2}-\d{2}$/.test(params.get('snapshot')) && latest.history.includes(params.get('snapshot')) ? params.get('snapshot') : '' };
}
const movement = team => {
  if (!team.lastRank) return '<span class="movement unchanged" aria-label="Previous rank unavailable">–</span>';
  const change = team.lastRank ? team.lastRank - team.rank : 0;
  return change ? `<span class="movement ${change > 0 ? 'up' : 'down'}" aria-label="${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} places">${change > 0 ? '↑' : '↓'} ${Math.abs(change)}</span>` : '<span class="movement unchanged" aria-label="No rank change">–</span>';
};
const empty = (title, description, icon = '◌') => `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span><h2>${e(title)}</h2><p>${e(description)}</p></div>`;
function teamHref(team, key, snapshot = '', season = config.season) {
  const club = clubForTeam(community, team, season);
  return club && !snapshot ? clubRoute(club.key, season) : hasTeamId(team) && season === config.season ? route(key, team.id, 'overview', snapshot) : null;
}
function teamLink(team, key, snapshot = '', season = config.season) {
  const href = teamHref(team, key, snapshot, season);
  const brand = season === config.season ? team : clubBrandTeam(community, clubSnapshot(), team, season);
  return `<${href ? `a href="${href}"` : 'span'} class="team-link">${badge(brand)}<span><strong>${e(brand.name)}</strong><small>${e(brand.manager)}</small></span></${href ? 'a' : 'span'}>`;
}
const filtered = (teams, season = config.season) => teams.filter(team => `${team.name} ${team.manager} ${clubBrandTeam(community, clubSnapshot(), team, season).name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
const places = {
  trophy: { label: 'PRE FTW trophy' },
  promotion: { label: 'Promotion' },
  relegation: { label: 'Relegation' }
};

function table(league, key, snapshot) {
  const teams = filtered(league.teams);
  const legend = key === 'A' ? ['trophy', 'relegation'] : key === 'D' ? ['promotion'] : ['promotion', 'relegation'];
  return `<section class="panel standings"><div class="panel-heading"><h2>Standings</h2><span class="subtle-label">Total points</span></div>
    <table><caption class="sr-only">League ${key} standings. Select a team to view its squad.</caption><thead><tr><th scope="col" class="rank-col">#</th><th scope="col">Team</th><th scope="col" class="numeric">GW<span class="sr-only"> points</span></th><th scope="col" class="numeric total-col">PTS<span class="sr-only"> total</span></th></tr></thead>
    <tbody>${teams.map(team => {
      const place = standingPlace(key, league.teams.indexOf(team) + 1, league.teams.length);
      const status = place ? `<span class="sr-only">${places[place].label} place</span>` : '';
      return `<tr${place ? ` class="${place}-row"` : ''}><td class="rank-col"><span class="rank-number">${team.rank}</span>${status}${movement(team)}</td><td>${teamLink(team, key, snapshot)}</td><td class="numeric gw-cell">${number(team.eventPoints)}</td><td class="numeric points-cell">${number(team.total)}</td></tr>`;
    }).join('')}</tbody></table>
    ${teams.length ? '' : '<p class="no-results" role="status">No teams match your search.</p>'}
    <div class="table-foot"><div class="places-legend">${legend.map(place => `<span class="${place}"><i class="legend-line"></i>${places[place].label}</span>`).join('')}</div><span>Places for next season · GW = gameweek</span></div></section>`;
}

function rail(league, key, snapshot) {
  const weekly = [...league.teams].sort((a, b) => b.eventPoints - a.eventPoints);
  const best = weekly[0], leader = league.teams[0];
  const average = league.teams.length ? league.teams.reduce((sum, team) => sum + team.eventPoints, 0) / league.teams.length : 0;
  return `<aside class="insights" aria-label="League highlights"><section class="panel weekly"><div class="panel-heading"><h2>This gameweek</h2><span class="tiny-accent">${league.gameweek ? `GW ${league.gameweek}` : 'LATEST'}</span></div>
    ${best ? `<div class="weekly-best"><span class="eyebrow">TOP SCORER${weekly.filter(t => t.eventPoints === best.eventPoints).length > 1 ? ' · JOINT' : ''}</span>${teamLink(best, key, snapshot)}<div class="big-score">${number(best.eventPoints)}<span>points</span></div></div><div class="weekly-average"><span>Division average</span><strong>${average.toFixed(1)} <small>pts</small></strong></div>` : '<p class="panel-copy">Waiting for the first scores.</p>'}</section>
    <section class="panel race"><div class="panel-heading"><h2>At the top</h2><span aria-hidden="true">↗</span></div>${leader ? `<div class="race-body">${teamLink(leader, key, snapshot)}<p><strong>${number(leader.total)}</strong> season points</p>${league.teams[1] ? `<div class="lead-gap"><span class="accent">+${number(leader.total - league.teams[1].total)}</span><span>ahead of second place</span></div>` : ''}</div>` : ''}</section>
    <section class="league-notes"><span class="eyebrow">THE LONG GAME</span><h2>Every point.<br>Every position.</h2><p>Four divisions, one season of bragging rights.</p><span class="notes-number" aria-hidden="true">04</span></section></aside>`;
}

function transactions(league, key, teamId = null, snapshot = '') {
  if (league.transactions === null) return `<section class="panel">${empty('Transactions not synced yet', 'Published waivers and free-agent moves will appear after the public API responds. Pending requests and private trades are not shown.', '⇄')}</section>`;
  const rows = league.transactions.filter(row => !teamId || row.teamId === teamId);
  return `<section class="panel"><div class="panel-heading"><h2>Published transactions</h2><span class="subtle-label">${rows.length} moves</span></div>${rows.length ? `<ul class="transaction-list">${rows.map(row => { const team = league.teams.find(t => t.id === row.teamId); return `<li><div class="transaction-meta"><span class="tiny-accent">GW ${row.gameweek} · ${e(row.kind)}</span><a href="${route(key, row.teamId, 'overview', snapshot)}">${e(team?.name ?? 'Team')}</a></div><div class="transfer-players"><span><b class="accent">↓ IN</b> ${e(row.playerIn)}</span><span><b class="muted">↑ OUT</b> ${e(row.playerOut)}</span></div></li>`; }).join('')}</ul>` : empty('No completed moves', 'There are no published completed transactions in the saved response.', '⇄')}</section>`;
}

function teamPage(league, team, current) {
  const club = clubForTeam(community, team, config.season);
  const view = !current.snapshot && club && getClubSeason(community, clubSnapshot(), club, config.season);
  const header = view ? renderClubSeason(club, { ...view, league: { ...league, name: view.league.name }, team }, clubSeasons(club), badge) : `<a class="back-link" href="${route(current.key, '', 'standings', current.snapshot)}">← League ${current.key} standings</a><section class="team-hero">${badge(team, true)}<div><span class="eyebrow">LEAGUE ${current.key} · ${e(config.season)}</span><h1>${e(team.name)}</h1><p>Managed by ${e(team.manager)}</p></div></section>
    <div class="team-summary"><div><span>League position</span><strong>${team.rank}<small> / ${league.teams.length}</small></strong></div><div><span>Season points</span><strong>${number(team.total)}</strong></div><div><span>${league.gameweek ? `Gameweek ${league.gameweek}` : 'Latest gameweek'}</span><strong class="accent">${number(team.eventPoints)}</strong></div><div><span>Waiver priority</span><strong>${number(team.waiverPick)}</strong></div></div>`;
  return `${header}
    <div class="content-grid team-content"><div>${renderLineup(team)}<div class="section-spacer">${transactions(league, current.key, team.id, current.snapshot)}</div></div><aside class="insights"><section class="panel"><div class="panel-heading"><h2>Team info</h2></div><dl class="info-list"><div><dt>Manager</dt><dd>${e(team.manager)}</dd></div><div><dt>Division</dt><dd>League ${current.key}</dd></div>${hasTeamId(team) ? `<div><dt>Team ID</dt><dd>${team.id}</dd></div>` : ''}<div><dt>Waiver priority</dt><dd>${number(team.waiverPick)}</dd></div><div><dt>Movement</dt><dd>${movement(team)}</dd></div></dl></section><div class="context-note"><strong>Points that count</strong><p>Standings use official team totals. Individual player points include the bench and are shown separately.</p></div></aside></div>`;
}

function historyView(league, key, snapshot) {
  return `<section class="panel"><div class="panel-heading"><h2>Daily snapshots</h2><span class="subtle-label">Saved standings</span></div>${latest.history.length ? `<div class="snapshot-control"><label for="snapshot">Snapshot date (UTC)</label><select id="snapshot"><option value="">Latest available</option>${latest.history.map(day => `<option value="${day}"${snapshot === day ? ' selected' : ''}>${day}</option>`).join('')}</select></div>` : empty('History starts with the first sync', 'Daily standings will be saved automatically. Earlier daily changes cannot be reconstructed from this sample.', '↺')}</section>${latest.history.length && league ? `<div class="section-spacer">${table(league, key, snapshot)}</div>` : ''}`;
}

function render() {
  const current = state();
  document.querySelector('#pages').innerHTML = [['home', 'Welcome'], ['stats', 'Gameweek stats'], ['archive', 'Record book']].map(([page, label]) => `<a href="#page=${page}"${current.page === page ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  document.querySelector('#divisions').innerHTML = config.divisions.map(d => `<a class="division-link${current.page === 'league' && d.key === current.key ? ' selected' : ''}" href="${route(d.key)}"${current.page === 'league' && d.key === current.key ? ' aria-current="page"' : ''}>${leagueEmblem(d.key)}<span>League ${d.key}<small>${(latest.divisions[d.key] ?? documented[d.key]) ? `${(latest.divisions[d.key] ?? documented[d.key]).teams.length} teams` : d.leagueId ? 'Awaiting first sync' : 'Awaiting league ID'}</small></span><span class="division-chevron" aria-hidden="true">›</span></a>`).join('');
  if (current.page === 'club' || current.page === 'competition') {
    if (current.page === 'club') {
      const club = (community.clubs ?? []).find(club => club.key === current.clubKey);
      const view = club && getClubSeason(community, clubSnapshot(), club, current.season);
      let content;
      if (!view) content = `<section class="panel">${empty('Club season not found', 'This club has no recorded participation in the selected season.')}</section>`;
      else if (view.historical) content = renderClubSeason(club, view, clubSeasons(club), badge);
      else {
        const source = view.league.source === 'provided' ? 'League-provided sample' : view.league.updatedAt ? `Standings updated ${date(view.league.updatedAt)}` : `Published GW ${view.league.gameweek} standings`;
        content = teamPage(view.league, view.team, { ...current, key: view.key }) + `<p class="archive-note">${source}${view.league.stale ? ' · Last refresh failed' : ''}</p>`;
      }
      app.innerHTML = content;
      bindClubSeason(club);
      document.title = `${view?.brandTeam.name ?? 'Club season'} · PRE FTW League`;
    } else {
      const league = getHistoricalLeague(community, current.season, current.competitionKey, current.week);
      app.innerHTML = league ? renderHistoricalLeague({ ...league, teams: filtered(league.teams, current.season) }, current.season, current.week, teamLink) : `<section class="panel">${empty('Competition not found', 'Choose a recorded competition from a club’s season page.')}</section>`;
      document.querySelector('#historical-week')?.addEventListener('change', event => { location.hash = historicalLeagueRoute(current.competitionKey, current.season, Number(event.target.value)); });
      document.title = `${league?.name ?? 'Competition'} · ${current.season} · PRE FTW League`;
    }
    app.setAttribute('aria-busy', 'false');
    return;
  }
  if (current.page !== 'league') {
    app.innerHTML = current.page === 'stats' ? renderStats(config, latest, current.week, teamLink, community, current.season) : current.page === 'archive' ? renderArchive(community, teamLink, clubSnapshot()) : renderWelcome(config, { divisions: { ...documented, ...latest.divisions } });
    document.title = `${current.page === 'stats' ? 'Gameweek stats' : current.page === 'archive' ? 'Record book' : 'Welcome'} · PRE FTW League`;
    app.setAttribute('aria-busy', 'false');
    document.querySelector('#stats-season')?.addEventListener('change', event => { location.hash = `#${new URLSearchParams({ page: 'stats', season: event.target.value })}`; });
    document.querySelector('#gameweek')?.addEventListener('change', event => { location.hash = `#${new URLSearchParams({ page: 'stats', season: current.season, gw: event.target.value })}`; });
    return;
  }
  const division = config.divisions.find(d => d.key === current.key);
  const league = displayed.divisions[current.key] ?? (!current.snapshot ? documented[current.key] : null);
  const team = current.teamId ? league?.teams.find(t => t.id === current.teamId) : null;
  const refreshFailed = (displayed.errors ?? []).some(error => error.startsWith(`League ${current.key} `));
  const status = !league ? (refreshFailed ? 'Sync failed' : 'Awaiting data') : league.source === 'documentation' ? `Published GW ${league.gameweek}` : league.source === 'provided' ? 'Sample standings' : league.stale ? 'Saved standings · refresh failed' : 'Saved standings';
  const freshEnough = league?.updatedAt && Date.now() - Date.parse(league.updatedAt) < 48 * 60 * 60 * 1000;
  const oldNotice = league?.source === 'api' && !freshEnough ? '<p class="notice">These standings are more than 48 hours old. Displaying the last saved data.</p>' : '';
  const notice = league?.source === 'documentation' ? `<p class="notice">Published GW ${league.gameweek} standings from the <a href="${e(league.sourceUrl)}" target="_blank" rel="noopener noreferrer">community journal</a>. Automatic squads and transactions await the league ID.</p>` : current.snapshot ? `<p class="notice">Viewing snapshot from ${current.snapshot} (UTC). <a href="${route(current.key)}">Return to latest →</a></p>` : league?.source === 'provided' ? `<p class="notice"><span aria-hidden="true">◷</span> Supplied league standings · ${league.stale ? 'Last refresh failed; sample preserved.' : 'Automatic updates have not run yet.'}</p>` : (league?.stale || refreshFailed) ? '<p class="notice">The last refresh failed. Any previous standings have been preserved.</p>' : oldNotice;
  const top = `<div class="breadcrumb">Competitions <span>/</span> PRE FTW League</div><section class="competition-hero"><img src="./assets/crest.webp" class="hero-crest" width="64" height="72" alt=""><div><div class="eyebrow"><span class="tiny-accent">FPL DRAFT</span><span class="eyebrow-dot">·</span> COMMUNITY LEAGUE</div><h1>PRE FTW League</h1><p>Four divisions. One community.</p></div><span class="hero-season">${e(config.season)}</span></section>`;
  const nav = `<nav class="section-nav" aria-label="League sections">${tabs.map(tab => `<a href="${route(current.key, '', tab.toLowerCase(), current.snapshot)}"${current.tab === tab.toLowerCase() ? ' aria-current="page"' : ''}>${tab}</a>`).join('')}</nav>`;
  const heading = `<div class="division-heading"><div class="division-title">${leagueEmblem(current.key)}<div><span class="eyebrow">${e(config.season)} SEASON</span><h2>League ${current.key} <span>${league ? `${league.teams.length} teams` : 'Not synced'}</span></h2></div></div><span class="data-status"><i></i>${status}</span></div>`;
  let content;
  if (current.teamId && !team) content = `<section class="panel">${empty('Team not found', 'Choose a team from this division’s standings.')}<a class="empty-back" href="${route(current.key)}">Back to League ${current.key} →</a></section>`;
  else if (team) content = teamPage(league, team, current);
  else if (current.tab === 'history') content = historyView(league, current.key, current.snapshot);
  else if (!league) content = `<section class="panel pending-division"><span class="pending-letter" aria-hidden="true">${current.key}</span>${empty(division.leagueId ? 'Ready for the first sync' : 'Another chapter is coming', division.leagueId ? `League ${current.key} is configured. Its standings will appear after the first successful data refresh.` : `League ${current.key} will join the table once its league ID is added.`)}<a class="empty-back" href="${route('D')}">Explore League D →</a></section>`;
  else if (current.tab === 'transactions') content = transactions(league, current.key, null, current.snapshot);
  else if (current.tab === 'teams') content = `<section class="teams-grid">${filtered(league.teams).map(t => `<${teamHref(t, current.key, current.snapshot) ? `a href="${teamHref(t, current.key, current.snapshot)}"` : 'article'} class="panel team-card"><div class="team-card-top">${badge(t)}<span class="subtle-label">#${t.rank} in League ${current.key}</span></div><h2>${e(t.name)}</h2><p>${e(t.manager)}</p><div class="team-card-bottom"><span><strong>${number(t.total)}</strong> pts</span><span>${teamHref(t, current.key, current.snapshot) ? 'View club' : 'Squad awaits league ID'} <b aria-hidden="true">→</b></span></div></${teamHref(t, current.key, current.snapshot) ? 'a' : 'article'}>`).join('') || empty('No matching teams', 'Try a different team or manager name.')}</section>`;
  else content = `<div class="content-grid"><div>${table(league, current.key, current.snapshot)}<details class="about-league"><summary>About this division <span aria-hidden="true">+</span></summary><p>${e(league.name)} · Classic total-points scoring. ${current.key === 'A' ? 'First place wins the PRE FTW League trophy. The bottom two teams move to League B.' : current.key === 'D' ? 'The top two teams move to League C. There is no relegation from League D.' : `The top two teams move to League ${current.key === 'B' ? 'A' : 'B'}. The bottom two move to League ${current.key === 'B' ? 'C' : 'D'}.`} Highlighted places show the current season-end projection.</p></details></div>${rail(league, current.key, current.snapshot)}</div>`;
  app.innerHTML = `${team ? '' : top + nav}${notice}${team ? '' : heading}${content}<div class="update-footer"><span>${league?.source === 'documentation' ? `Source: community journal GW ${league.gameweek}` : league?.updatedAt ? `Standings updated ${date(league.updatedAt)}` : league ? 'Source: league-provided sample · Sync pending' : 'No standings received yet'}</span><span>${league?.source === 'documentation' ? 'Published report' : 'Daily updates'} · ${e(config.season)}</span></div>${league?.warnings?.length ? `<details class="sync-notes"><summary>Data availability (${league.warnings.length})</summary><ul>${league.warnings.map(w => `<li>${e(w)}</li>`).join('')}</ul></details>` : ''}`;
  document.title = `${team ? team.name : `League ${current.key}`} · PRE FTW League`;
  app.setAttribute('aria-busy', 'false');
  if (team) bindClubSeason(clubForTeam(community, team, config.season));
  document.querySelector('#snapshot')?.addEventListener('change', event => { location.hash = route(current.key, '', 'history', event.target.value); });
}

async function loadRoute() {
  const version = ++loadVersion;
  const current = state();
  displayed = latest;
  if (current.page === 'league' && current.snapshot) {
    app.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(`./data/history/${current.snapshot}.json`);
      if (!response.ok) throw new Error('Snapshot unavailable');
      const snapshot = await response.json();
      if (version !== loadVersion) return;
      displayed = snapshot;
    } catch {
      if (version !== loadVersion) return;
      app.innerHTML = `<section class="panel">${empty('Snapshot could not be loaded', 'The saved snapshot is unavailable. Return to the latest standings.')}<a class="empty-back" href="${route(current.key)}">Latest standings →</a></section>`;
      app.setAttribute('aria-busy', 'false');
      return;
    }
  }
  render();
}

async function start() {
  const responses = await Promise.all(['./data/config.json', './data/latest.json'].map(path => fetch(path, { cache: 'no-cache' })));
  if (responses.some(response => !response.ok)) throw new Error('Data unavailable');
  [config, latest] = await Promise.all(responses.map(response => response.json()));
  community = await fetch('./data/community.json').then(response => response.ok ? response.json() : community).catch(() => community);
  documented = Object.fromEntries(config.divisions.map(division => [division.key, documentedDivision(community, division.key, config.season)]).filter(([, league]) => league));
  window.addEventListener('hashchange', async () => {
    query = ''; search.value = '';
    await loadRoute();
    document.querySelector('#main').focus({ preventScroll: true });
  });
  search.addEventListener('input', () => {
    query = search.value.trim();
    const current = state();
    if (query && current.page === 'club') {
      const club = (community.clubs ?? []).find(club => club.key === current.clubKey);
      const view = club && getClubSeason(community, clubSnapshot(), club, current.season);
      if (view) history.replaceState(null, '', view.historical ? historicalLeagueRoute(view.key, current.season) : route(view.key, '', 'teams'));
    } else if (query && current.page !== 'competition' && (current.page !== 'league' || current.teamId || !['overview', 'standings', 'teams'].includes(current.tab))) {
      history.replaceState(null, '', route(current.key, '', 'teams', current.snapshot));
    }
    render();
  });
  await loadRoute();
}
start().catch(() => {
  app.innerHTML = `<section class="panel">${empty('The league is taking a breather', 'We could not load the saved standings. Please try again.')}<button id="retry" class="retry-button">Try again</button></section>`;
  app.setAttribute('aria-busy', 'false');
  document.querySelector('#retry').addEventListener('click', () => location.reload());
});
