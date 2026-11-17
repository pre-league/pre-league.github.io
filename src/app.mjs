import { escapeHtml as e, standingPlace } from './model.mjs';
import { renderLineup, handleHeadshotError } from './lineup.mjs';
import { renderWelcome, renderStats, renderArchive, leagueEmblem } from './pages.mjs';
import { documentedDivision, teamBenchPoints, leagueGameweek } from './stats.mjs';
import { clubForTeam, clubBrandTeam, clubRoute, historicalLeagueRoute, getClubSeason, getHistoricalLeague, renderClubSeason, renderHistoricalLeague } from './clubs.mjs';

const app = document.querySelector('#app');
const handleImageError = event => {
  if (event.target?.matches?.('img.team-crest') || event.target?.matches?.('img.league-emblem')) event.target.remove();
  else handleHeadshotError(event);
};
app.addEventListener('error', handleImageError, true);
document.querySelector('#divisions').addEventListener('error', handleImageError, true);
const search = document.querySelector('#search');
let config, latest, documented = {}, community = { seasons: [], documents: [] }, query = '', lastLeague = 'A';
const navIcons = {
  home: 'M3 10 12 3l9 7v10H15v-6H9v6H3Z',
  leagues: 'M8 3h8v5a4 4 0 0 1-8 0Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 1v7m-4 2h8',
  stats: 'M4 20V10h4v10m4 0V4h4v16m4 0v-7M2 20h20',
  archive: 'M4 4h7a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4Zm10 3a3 3 0 0 1 3-3h3v15h-2a4 4 0 0 0-4 2'
};
const tabs = [['standings', 'Table'], ['teams', 'Teams'], ['transactions', 'Transfers'], ['history', 'History']];
const number = value => value == null ? '—' : new Intl.NumberFormat('en-GB').format(value);
const date = value => value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sample provided by the league';
const hasTeamId = team => Number.isSafeInteger(team.id) && team.id > 0;
const badge = (team, large = false) => `<span class="team-badge color-${(team.id ?? 0) % 4}${large ? ' large' : ''}" aria-hidden="true"><span class="team-initials">${e(team.name.split(/\s+/).slice(0, 2).map(word => word[0]).join(''))}</span>${hasTeamId(team) ? `<img class="team-crest" src="./assets/crest/thumbs/${team.id}.webp" alt="" width="${large ? 72 : 32}" height="${large ? 82 : 37}" loading="lazy" decoding="async">` : ''}</span>`;
const route = (league, team = '', tab = 'overview') => `#${new URLSearchParams({ league, ...(team ? { team } : {}), tab })}`;
const clubSnapshot = () => ({ ...latest, divisions: { ...documented, ...latest.divisions } });
const clubSeasons = club => [config.season, ...(community.seasons ?? []).map(row => row.season)].filter(season => getClubSeason(community, clubSnapshot(), club, season));
function bindClubSeason(club) {
  if (club) document.querySelector('#club-season')?.addEventListener('change', event => { location.hash = clubRoute(club.key, event.target.value); });
}
function state() {
  const params = new URLSearchParams(location.hash.slice(1));
  const page = ['home', 'stats', 'archive', 'club', 'competition'].includes(params.get('page')) ? params.get('page') : params.has('league') ? 'league' : 'home';
  return { page, clubKey: params.get('club'), competitionKey: params.get('league'), season: [config.season, ...(community.seasons ?? []).map(row => row.season)].includes(params.get('season')) ? params.get('season') : config.season, week: Number(params.get('gw')), key: /^[A-D]$/.test(params.get('league')) ? params.get('league') : 'D', teamId: Number(params.get('team')), tab: tabs.some(([key]) => key === params.get('tab')) ? params.get('tab') : 'standings' };
}
const movement = team => {
  if (!team.lastRank) return '<span class="movement unchanged" aria-label="Previous rank unavailable">–</span>';
  const change = team.lastRank ? team.lastRank - team.rank : 0;
  return change ? `<span class="movement ${change > 0 ? 'up' : 'down'}" aria-label="${change > 0 ? 'Up' : 'Down'} ${Math.abs(change)} places">${change > 0 ? '↑' : '↓'} ${Math.abs(change)}</span>` : '<span class="movement unchanged" aria-label="No rank change">–</span>';
};
const empty = (title, description, icon = '◌') => `<div class="empty"><span class="empty-icon" aria-hidden="true">${icon}</span><h2>${e(title)}</h2><p>${e(description)}</p></div>`;
function teamHref(team, key, season = config.season) {
  const club = clubForTeam(community, team, season);
  return club ? clubRoute(club.key, season) : hasTeamId(team) && season === config.season ? route(key, team.id) : null;
}
function teamLink(team, key, season = config.season) {
  const href = teamHref(team, key, season);
  const brand = clubBrandTeam(community, clubSnapshot(), team, season);
  return `<${href ? `a href="${href}"` : 'span'} class="team-link">${badge(brand)}<span><strong>${e(brand.name)}</strong><small>${e(brand.manager)}</small></span></${href ? 'a' : 'span'}>`;
}
const filtered = (teams, season = config.season) => teams.filter(team => `${team.name} ${team.manager} ${clubBrandTeam(community, clubSnapshot(), team, season).name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
const places = {
  trophy: { label: 'PRE FTW trophy' },
  promotion: { label: 'Promotion' },
  relegation: { label: 'Relegation' }
};

function table(league, key, heading = 'Standings') {
  const teams = filtered(league.teams);
  const legend = key === 'A' ? ['trophy', 'relegation'] : key === 'D' ? ['promotion'] : ['promotion', 'relegation'];
  return `<section class="panel standings"><div class="panel-heading"><h2>${e(heading)}</h2><span class="subtle-label">Total points</span></div>
    <div class="standings-scroll" role="region" aria-label="League ${key} standings" tabindex="0"><table><caption class="sr-only">League ${key} standings. Select a team to view its squad.</caption><thead><tr><th scope="col" class="rank-col">#</th><th scope="col">Team</th><th scope="col" class="numeric">GW<span class="sr-only"> points</span></th><th scope="col" class="numeric">Bench<span class="sr-only"> points</span></th><th scope="col" class="numeric total-col">PTS<span class="sr-only"> total</span></th></tr></thead>
    <tbody>${teams.map(team => {
      const place = standingPlace(key, league.teams.indexOf(team) + 1, league.teams.length);
      const status = place ? `<span class="sr-only">${places[place].label} place</span>` : '';
      return `<tr${place ? ` class="${place}-row"` : ''}><td class="rank-col"><span class="rank-number">${team.rank}</span>${status}${movement(team)}</td><td>${teamLink(team, key)}</td><td class="numeric gw-cell">${number(team.eventPoints)}</td><td class="numeric bench-cell">${number(teamBenchPoints(team, league.gameweek))}</td><td class="numeric points-cell">${number(team.total)}</td></tr>`;
    }).join('')}</tbody></table></div>
    ${teams.length ? '' : '<p class="no-results" role="status">No teams match your search.</p>'}
    <div class="table-foot"><div class="places-legend">${legend.map(place => `<span class="${place}"><i class="legend-line"></i>${places[place].label}</span>`).join('')}</div><span>Places for next season · GW / Bench = gameweek points · — = unavailable</span></div></section>`;
}

function rail(league, key) {
  const weekly = [...league.teams].sort((a, b) => b.eventPoints - a.eventPoints);
  const best = weekly[0], leader = league.teams[0];
  const average = league.teams.length ? league.teams.reduce((sum, team) => sum + team.eventPoints, 0) / league.teams.length : 0;
  return `<aside class="insights" aria-label="League highlights"><section class="panel weekly"><div class="panel-heading"><h2>This gameweek</h2><span class="tiny-accent">${league.gameweek ? `GW ${league.gameweek}` : 'LATEST'}</span></div>
    ${best ? `<div class="weekly-best"><span class="eyebrow">TOP SCORER${weekly.filter(t => t.eventPoints === best.eventPoints).length > 1 ? ' · JOINT' : ''}</span>${teamLink(best, key)}<div class="big-score">${number(best.eventPoints)}<span>points</span></div></div><div class="weekly-average"><span>Division average</span><strong>${average.toFixed(1)} <small>pts</small></strong></div>` : '<p class="panel-copy">Waiting for the first scores.</p>'}</section>
    <section class="panel race"><div class="panel-heading"><h2>At the top</h2><span aria-hidden="true">↗</span></div>${leader ? `<div class="race-body">${teamLink(leader, key)}<p><strong>${number(leader.total)}</strong> season points</p>${league.teams[1] ? `<div class="lead-gap"><span class="accent">+${number(leader.total - league.teams[1].total)}</span><span>ahead of second place</span></div>` : ''}</div>` : ''}</section>
    <section class="league-notes"><span class="eyebrow">THE LONG GAME</span><h2>Every point.<br>Every position.</h2><p>Four divisions, one season of bragging rights.</p><span class="notes-number" aria-hidden="true">04</span></section></aside>`;
}

function transactions(league, key, teamId = null) {
  if (league.transactions === null) return `<section class="panel">${empty('Transactions not synced yet', 'Published waivers and free-agent moves will appear after the public API responds. Pending requests and private trades are not shown.', '⇄')}</section>`;
  const rows = league.transactions.filter(row => !teamId || row.teamId === teamId);
  return `<section class="panel"><div class="panel-heading"><h2>Published transactions</h2><span class="subtle-label">${rows.length} moves</span></div>${rows.length ? `<ul class="transaction-list">${rows.map(row => { const team = league.teams.find(t => t.id === row.teamId); return `<li><div class="transaction-meta"><span class="tiny-accent">GW ${row.gameweek} · ${e(row.kind)}</span><a href="${route(key, row.teamId)}">${e(team?.name ?? 'Team')}</a></div><div class="transfer-players"><span><b class="accent">↓ IN</b> ${e(row.playerIn)}</span><span><b class="muted">↑ OUT</b> ${e(row.playerOut)}</span></div></li>`; }).join('')}</ul>` : empty('No completed moves', 'There are no published completed transactions in the saved response.', '⇄')}</section>`;
}

function teamPage(league, team, current) {
  const club = clubForTeam(community, team, config.season);
  const view = club && getClubSeason(community, clubSnapshot(), club, config.season);
  const header = view ? renderClubSeason(club, { ...view, league: { ...league, name: view.league.name }, team }, clubSeasons(club), badge) : `<a class="back-link" href="${route(current.key, '', 'standings')}">← League ${current.key} standings</a><section class="team-hero">${badge(team, true)}<div><span class="eyebrow">LEAGUE ${current.key} · ${e(config.season)}</span><h1>${e(team.name)}</h1><p>Managed by ${e(team.manager)}</p></div></section>
    <div class="team-summary"><div><span>League position</span><strong>${team.rank}<small> / ${league.teams.length}</small></strong></div><div><span>Season points</span><strong>${number(team.total)}</strong></div><div><span>${league.gameweek ? `Gameweek ${league.gameweek}` : 'Latest gameweek'}</span><strong class="accent">${number(team.eventPoints)}</strong></div><div><span>Waiver priority</span><strong>${number(team.waiverPick)}</strong></div></div>`;
  return `${header}
    <div class="content-grid team-content"><div>${renderLineup(team)}<div class="section-spacer">${transactions(league, current.key, team.id)}</div></div><aside class="insights"><section class="panel"><div class="panel-heading"><h2>Team info</h2></div><dl class="info-list"><div><dt>Manager</dt><dd>${e(team.manager)}</dd></div><div><dt>Division</dt><dd>League ${current.key}</dd></div>${hasTeamId(team) ? `<div><dt>Team ID</dt><dd>${team.id}</dd></div>` : ''}<div><dt>Waiver priority</dt><dd>${number(team.waiverPick)}</dd></div><div><dt>Movement</dt><dd>${movement(team)}</dd></div></dl></section><div class="context-note"><strong>Points that count</strong><p>Standings use official team totals. Individual player points include the bench and are shown separately.</p></div></aside></div>`;
}

function historyView(history, key) {
  const { weeks, gameweek, league } = history;
  return `<section class="panel"><div class="panel-heading"><h2>Gameweek history</h2><span class="subtle-label">${e(config.season)}</span></div>${weeks.length ? `<div class="history-control"><label for="league-gameweek">Gameweek</label><select id="league-gameweek">${league ? '' : '<option value="" selected disabled>Choose a gameweek</option>'}${weeks.map(week => `<option value="${week}"${week === gameweek ? ' selected' : ''}>GW ${week}</option>`).join('')}</select></div>` : ''}</section>${league ? `<div class="section-spacer">${table(league, key, `Standings at GW ${gameweek}`)}</div><p class="panel-copy">Positions use cumulative points at the selected gameweek. GW and Bench show points for that week; unavailable scores remain a dash.</p>` : empty(weeks.length ? 'Gameweek unavailable' : 'No gameweeks saved yet', weeks.length ? 'No scores were recorded for this gameweek. Choose an available gameweek above.' : 'Gameweek standings will appear after scores are saved.')}`;
}

function searchResults() {
  const snapshot = clubSnapshot();
  const matches = config.divisions.flatMap(({ key }) => filtered(snapshot.divisions[key]?.teams ?? []).map(team => ({ team, key, season: config.season })));
  for (const club of community.clubs ?? []) {
    if (getClubSeason(community, snapshot, club, config.season)) continue;
    const view = (community.seasons ?? []).map(({ season }) => getClubSeason(community, snapshot, club, season)).find(Boolean);
    if (view && filtered([view.team], view.season).length) matches.push(view);
  }
  return `<div class="page-heading"><h1>Search clubs</h1><p role="status">${matches.length} results across all leagues</p></div><section class="panel">${matches.length ? `<ul class="transaction-list">${matches.map(({ team, key, season }) => `<li><div class="transaction-meta">${teamLink(team, key, season)}<a class="club-competition" href="${season === config.season ? route(key) : historicalLeagueRoute(key, season)}">League ${e(key)} &middot; ${e(season)}</a></div></li>`).join('')}</ul>` : '<p class="no-results" role="status">No clubs match your search.</p>'}</section>`;
}

function render() {
  const current = state();
  document.querySelector('#main').setAttribute('data-page', current.page === 'league' && current.teamId ? 'club' : current.page);
  if (current.page === 'league') lastLeague = current.key;
  else if (current.page === 'club') {
    const club = (community.clubs ?? []).find(club => club.key === current.clubKey);
    const view = club && getClubSeason(community, clubSnapshot(), club, config.season);
    if (view) lastLeague = view.key;
  }
  const selectedPage = ['league', 'club', 'competition'].includes(current.page) ? 'leagues' : current.page;
  document.querySelector('#pages').innerHTML = [['home', 'Home'], ['leagues', 'Leagues'], ['stats', 'Stats'], ['archive', 'Records']].map(([page, label]) => `<a data-nav="${page}" href="${page === 'leagues' ? route(lastLeague) : `#page=${page}`}"${selectedPage === page ? ' aria-current="page"' : ''}><svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${navIcons[page]}"></path></svg><span>${label}</span></a>`).join('');
  document.querySelector('#divisions').innerHTML = config.divisions.map(d => `<a class="division-link${current.page === 'league' && d.key === current.key ? ' selected' : ''}" href="${route(d.key)}"${current.page === 'league' && d.key === current.key ? ' aria-current="page"' : ''}>${leagueEmblem(d.key)}<span>League ${d.key}<small>${(latest.divisions[d.key] ?? documented[d.key]) ? `${(latest.divisions[d.key] ?? documented[d.key]).teams.length} teams` : d.leagueId ? 'Awaiting first sync' : 'Awaiting league ID'}</small></span><span class="division-chevron" aria-hidden="true">›</span></a>`).join('');
  if (query) {
    app.innerHTML = searchResults();
    document.title = 'Search clubs · PRE FTW League';
    app.setAttribute('aria-busy', 'false');
    return;
  }
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
  const history = current.tab === 'history' && !current.teamId ? leagueGameweek(latest, community, current.key, config.season, current.week) : null;
  const league = history ? history.league : latest.divisions[current.key] ?? documented[current.key];
  const team = current.teamId ? league?.teams.find(t => t.id === current.teamId) : null;
  const refreshFailed = !history && (latest.errors ?? []).some(error => error.startsWith(`League ${current.key} `));
  const status = history ? (league ? `GW ${league.gameweek} standings` : 'No gameweek standings') : !league ? (refreshFailed ? 'Sync failed' : 'Awaiting data') : league.source === 'documentation' ? `Published GW ${league.gameweek}` : league.source === 'provided' ? 'Sample standings' : league.stale ? 'Saved standings · refresh failed' : 'Saved standings';
  const freshEnough = league?.updatedAt && Date.now() - Date.parse(league.updatedAt) < 48 * 60 * 60 * 1000;
  const oldNotice = league?.source === 'api' && !freshEnough ? '<p class="notice">These standings are more than 48 hours old. Displaying the last saved data.</p>' : '';
  const notice = league?.source === 'documentation' ? `<p class="notice">Published GW ${league.gameweek} standings from the <a href="${e(league.sourceUrl)}" target="_blank" rel="noopener noreferrer">community journal</a>.${history ? '' : division.leagueId ? ' Automatic squads and transactions await a successful API sync.' : ' Automatic squads and transactions await the league ID.'}</p>` : league?.source === 'provided' ? `<p class="notice"><span aria-hidden="true">◷</span> Supplied league standings · ${league.stale ? 'Last refresh failed; sample preserved.' : 'Automatic updates have not run yet.'}</p>` : (league?.stale || refreshFailed) ? '<p class="notice">The last refresh failed. Any previous standings have been preserved.</p>' : oldNotice;
  const top = `<section class="competition-hero league-hero">${leagueEmblem(current.key)}<div><span class="eyebrow">PRE FTW &middot; ${e(config.season)}</span><h1>League ${current.key}</h1></div><div class="league-meta"><span>${league ? `${league.teams.length} teams` : 'Awaiting standings'}</span><span class="data-status"><i></i>${status}</span></div></section>
    <nav class="league-switcher" aria-label="Choose a division">${config.divisions.map(d => `<a class="division-link${d.key === current.key ? ' selected' : ''}" href="${route(d.key)}" aria-label="League ${d.key}"${d.key === current.key ? ' aria-current="page"' : ''}>${leagueEmblem(d.key)}<span>${d.key}</span></a>`).join('')}</nav>`;
  const nav = `<nav class="section-nav" aria-label="League sections">${tabs.map(([key, label]) => `<a href="${route(current.key, '', key)}"${current.tab === key ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav>`;
  let content;
  if (current.teamId && !team) content = `<section class="panel">${empty('Team not found', 'Choose a team from this division’s standings.')}<a class="empty-back" href="${route(current.key)}">Back to League ${current.key} →</a></section>`;
  else if (team) content = teamPage(league, team, current);
  else if (current.tab === 'history') content = historyView(history, current.key);
  else if (!league) content = `<section class="panel pending-division"><span class="pending-letter" aria-hidden="true">${current.key}</span>${empty(division.leagueId ? 'Ready for the first sync' : 'Another chapter is coming', division.leagueId ? `League ${current.key} is configured. Its standings will appear after the first successful data refresh.` : `League ${current.key} will join the table once its league ID is added.`)}<a class="empty-back" href="${route('D')}">Explore League D →</a></section>`;
  else if (current.tab === 'transactions') content = transactions(league, current.key);
  else if (current.tab === 'teams') content = `<section class="teams-grid">${filtered(league.teams).map(t => `<${teamHref(t, current.key) ? `a href="${teamHref(t, current.key)}"` : 'article'} class="panel team-card"><div class="team-card-top">${badge(t)}<span class="subtle-label">#${t.rank} in League ${current.key}</span></div><h2>${e(t.name)}</h2><p>${e(t.manager)}</p><div class="team-card-bottom"><span><strong>${number(t.total)}</strong> pts</span><span>${teamHref(t, current.key) ? 'View club' : 'Squad awaits league ID'} <b aria-hidden="true">→</b></span></div></${teamHref(t, current.key) ? 'a' : 'article'}>`).join('') || empty('No matching teams', 'Try a different team or manager name.')}</section>`;
  else content = `<div class="content-grid"><div>${table(league, current.key)}<details class="about-league"><summary>About this division <span aria-hidden="true">+</span></summary><p>${e(league.name)} · Classic total-points scoring. ${current.key === 'A' ? 'First place wins the PRE FTW League trophy. The bottom two teams move to League B.' : current.key === 'D' ? 'The top two teams move to League C. There is no relegation from League D.' : `The top two teams move to League ${current.key === 'B' ? 'A' : 'B'}. The bottom two move to League ${current.key === 'B' ? 'C' : 'D'}.`} Highlighted places show the current season-end projection.</p></details></div>${rail(league, current.key)}</div>`;
  app.innerHTML = `${team ? '' : top + nav}${notice}${content}<div class="update-footer"><span>${history ? (league ? `Saved scores for GW ${league.gameweek}` : 'No scores for this gameweek') : league?.source === 'documentation' ? `Source: community journal GW ${league.gameweek}` : league?.updatedAt ? `Standings updated ${date(league.updatedAt)}` : league ? 'Source: league-provided sample · Sync pending' : 'No standings received yet'}</span><span>${history ? 'Gameweek history' : league?.source === 'documentation' ? 'Published report' : 'Daily updates'} · ${e(config.season)}</span></div>${league?.warnings?.length ? `<details class="sync-notes"><summary>Data availability (${league.warnings.length})</summary><ul>${league.warnings.map(w => `<li>${e(w)}</li>`).join('')}</ul></details>` : ''}`;
  document.title = `${team ? team.name : `League ${current.key}`} · PRE FTW League`;
  app.setAttribute('aria-busy', 'false');
  if (team) bindClubSeason(clubForTeam(community, team, config.season));
  document.querySelector('#league-gameweek')?.addEventListener('change', event => { location.hash = `#${new URLSearchParams({ league: current.key, tab: 'history', gw: event.target.value })}`; });
}

async function start() {
  const responses = await Promise.all(['./data/config.json', './data/latest.json'].map(path => fetch(path, { cache: 'no-cache' })));
  if (responses.some(response => !response.ok)) throw new Error('Data unavailable');
  [config, latest] = await Promise.all(responses.map(response => response.json()));
  community = await fetch('./data/community.json').then(response => response.ok ? response.json() : community).catch(() => community);
  documented = Object.fromEntries(config.divisions.map(division => [division.key, documentedDivision(community, division.key, config.season)]).filter(([, league]) => league));
  window.addEventListener('hashchange', () => {
    query = ''; search.value = '';
    render();
    document.querySelector('#main').focus({ preventScroll: true });
  });
  search.addEventListener('input', () => {
    query = search.value.trim();
    render();
  });
  render();
}
start().catch(() => {
  app.innerHTML = `<section class="panel">${empty('The league is taking a breather', 'We could not load the saved standings. Please try again.')}<button id="retry" class="retry-button">Try again</button></section>`;
  app.setAttribute('aria-busy', 'false');
  document.querySelector('#retry').addEventListener('click', () => location.reload());
});
