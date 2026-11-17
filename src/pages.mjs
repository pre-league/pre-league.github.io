import { escapeHtml as e } from './model.mjs';
import { combinedWeeklyRecords, weeklyAwards } from './stats.mjs';
import { clubForTeam, clubBrandTeam, clubRoute } from './clubs.mjs';

const points = value => value == null ? '—' : new Intl.NumberFormat('en-GB').format(value);
const sourceLinks = sources => (sources ?? []).map(source => `<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(source.title)} ↗</a>`).join('');

export const leagueEmblem = key => `<span class="division-icon" aria-hidden="true"><span class="division-letter">${e(key)}</span><img class="league-emblem" src="./assets/league/thumbs/${e(key)}.webp" alt="" width="48" height="48" decoding="async"></span>`;

export function renderWelcome(config, latest) {
  return `<section class="welcome"><img src="./assets/crest.webp" width="40" height="48" alt=""><div class="welcome-copy"><span class="eyebrow">${e(config.season)} &middot; FPL DRAFT</span><h1>Welcome to PRE FTW League.</h1><p>Your clubs, standings and gameweek points.</p></div></section>
    <section class="welcome-divisions" aria-label="Choose a division">${config.divisions.map(division => `<a href="#league=${division.key}">${leagueEmblem(division.key)}<strong>League ${division.key}</strong><small>${latest.divisions[division.key] ? `${latest.divisions[division.key].teams.length} teams` : division.leagueId ? 'Awaiting sync' : 'Coming soon'}</small><span class="accent" aria-hidden="true">→</span></a>`).join('')}</section>
    <div class="welcome-bottom"><a href="#page=stats">Gameweek stats &rarr;</a><a href="#page=archive">Record book →</a><a href="https://sites.google.com/view/prefantasydraft" target="_blank" rel="noopener noreferrer">Our community documentation ↗</a></div>`;
}

export function renderStats(config, snapshot, selectedWeek, teamLink, community = {}, selectedSeason = config.season) {
  const historic = (community.seasons ?? []).find(season => season.season === selectedSeason && season.season !== config.season && season.weekly);
  const season = historic?.season ?? config.season;
  const divisionCount = historic ? Object.keys(historic.leagues).length : config.divisions.length;
  const seasons = [config.season, ...(community.seasons ?? []).filter(row => row.weekly && row.season !== config.season).map(row => row.season)];
  const weekly = historic ? historic.weekly : combinedWeeklyRecords(snapshot, community, config.season);
  const weeks = Object.keys(weekly).map(Number).sort((a, b) => b - a);
  const gameweek = weeks.includes(selectedWeek) ? selectedWeek : weeks[0];
  const awards = weeklyAwards(weekly, gameweek);
  const coverage = `${awards.divisions.length}/${divisionCount}`;
  const reports = !historic && community.currentSeason === config.season ? community.reports ?? [] : [];
  const report = reports.find(report => report.gameweek === gameweek && report.season === season);
  const documented = Object.values(weekly[gameweek] ?? {}).some(division => division.source === 'documentation');
  function card(title, description, award, style) {
    return `<section class="panel award-card ${style}"><div class="award-heading"><h2 class="award-label">${e(title)}</h2><div class="award-score">${points(award.value)}<span>points</span></div></div><p class="award-definition">${e(description)}</p>${award.winners.length ? `<div class="award-winners">${award.winners.map(team => `<div>${teamLink(team, team.division, season)}<span class="award-division">League ${team.division}</span></div>`).join('')}</div>${award.winners.length > 1 ? '<p class="award-tie">Joint winners</p>' : ''}` : '<p class="muted">No scores available yet.</p>'}${style === 'bench-award' && awards.teams.length ? `<p class="award-coverage">Bench scores: ${award.knownTeams}/${awards.teams.length} teams</p>` : ''}</section>`;
  }
  return `<div class="page-heading"><span class="eyebrow">ACROSS THE DIVISIONS</span><h1>Gameweek stats</h1><p>The people behind the points.</p></div><div class="stats-toolbar"><div class="control-field"><label for="stats-season">Season</label><select id="stats-season">${seasons.map(value => `<option value="${e(value)}"${value === season ? ' selected' : ''}>${e(value)}</option>`).join('')}</select></div>${weeks.length ? `<div class="control-field"><label for="gameweek">Gameweek</label><select id="gameweek">${weeks.map(week => `<option value="${week}"${week === gameweek ? ' selected' : ''}>GW ${week}</option>`).join('')}</select></div><span>${awards.teams.length} teams</span>` : ''}</div>${weeks.length ? '' : '<p class="notice">No gameweek data has been saved yet. Awards will appear after a successful sync.</p>'}
    ${weeks.length && awards.divisions.length < divisionCount ? `<p class="notice">Partial coverage: ${coverage} ${historic ? 'leagues' : 'divisions'} have saved scores for GW ${gameweek} (${awards.divisions.join(', ')}). Winners may change when the other divisions are connected.</p>` : ''}
    ${documented ? `<p class="notice">Includes published ${historic ? 'workbook' : 'journal'} scores. ${e(historic?.scoreMethod ?? community.scoreMethod ?? '')}${historic ? '' : ' API scores take priority where available.'}</p>` : ''}
    <div class="awards-grid">${card('Week’s MVP', 'Most team points this gameweek, across all leagues.', awards.mvp, 'mvp-award')}${card('Absolute Leader', 'Most season points at this gameweek, across all leagues.', awards.leader, 'leader-award')}${card('Unlucky', 'Most points left on the bench this gameweek.', awards.unlucky, 'bench-award')}</div>
    ${awards.unlucky.knownTeams < awards.teams.length ? '<p class="archive-note">Unlucky compares known bench scores, including published award scores. Other bench totals are unavailable.</p>' : ''}
    ${historic ? `<div class="archive-sources">${sourceLinks(historic.sources)}</div>` : ''}
    ${report ? `<details class="panel journal-report"><summary>GW ${gameweek} · ${e(report.title)}</summary><article lang="pt">${report.paragraphs.map(paragraph => `<p>${e(paragraph)}</p>`).join('')}</article>${sourceLinks([{ title: 'Read the original report', url: report.sourceUrl }])}</details>` : ''}
    ${awards.teams.length ? `<section class="panel stats-ranking"><div class="panel-heading"><h2>Gameweek leaderboard</h2><span class="subtle-label">GW ${gameweek}</span></div><div class="stats-table-scroll" role="region" aria-label="Gameweek leaderboard" tabindex="0"><table><caption class="sr-only">All available teams for gameweek ${gameweek}</caption><thead><tr><th scope="col">Team</th><th scope="col">League</th><th scope="col" class="numeric">GW</th><th scope="col" class="numeric">Total</th><th scope="col" class="numeric">Bench</th></tr></thead><tbody>${[...awards.teams].sort((a, b) => b.gameweekPoints - a.gameweekPoints).map(team => `<tr><td>${teamLink(team, team.division, season)}</td><td>${team.division}</td><td class="numeric">${points(team.gameweekPoints)}</td><td class="numeric">${points(team.totalPoints)}</td><td class="numeric">${points(team.benchPoints)}</td></tr>`).join('')}</tbody></table></div></section><p class="panel-copy">Saved gameweek scores · — means unavailable. Shared scores keep all joint winners. ${historic ? 'Historical scores come from the completed season workbook.' : 'Awards update with each successful daily sync.'}</p>` : ''}`;
}

export function renderArchive(community, teamLink, snapshot = {}) {
  const winner = (name, season) => {
    const club = clubForTeam(community, { name }, season);
    if (club && teamLink) return teamLink({ name, manager: club.manager, id: null }, '', season);
    return club ? `<a href="${clubRoute(club.key, season)}">${e(name)}</a>` : e(name);
  };
  const story = (text, season) => text.replace(/\b\w+\b/g, name => clubBrandTeam(community, snapshot, { name }, season).name);
  return `<div class="page-heading"><span class="eyebrow">OUR HISTORY</span><h1>Record book</h1><p>The winners and the stories we keep. Club pages link to each season's competitions.</p></div>
    ${(community.seasons ?? []).map(season => `<section class="season-section"><div class="season-heading"><h2>${e(season.season)}</h2><span>${Object.keys(season.leagues).length} standalone leagues</span></div>
      ${(season.notes ?? []).map(note => `<p class="archive-note">${e(note)}</p>`).join('')}
      <ul class="archive-champions">${Object.entries(season.champions ?? {}).map(([key, name]) => `<li><span>League ${e(key)} champion</span><strong>${winner(name, season.season)}</strong></li>`).join('')}</ul>
      ${(season.competitions ?? []).map(competition => `<section class="panel archive-competition"><div class="panel-heading"><h3>${e(competition.name)}</h3><span class="subtle-label">Separate competition</span></div><ol>${competition.podium.map(team => `<li value="${team.rank}">${winner(team.name, season.season)}</li>`).join('')}</ol></section>`).join('')}
      <div class="archive-sources">${sourceLinks(season.sources)}</div></section>`).join('')}
    ${(community.records ?? []).length ? `<section class="season-section"><div class="season-heading"><h2>Record book</h2></div><div class="archive-records">${community.records.map(record => `<section class="panel record-card"><span class="eyebrow">${e(record.season)}</span><h3>${e(record.label)}</h3><strong>${points(record.value)} <small>${e(record.unit)}</small></strong><p>${winner(record.holder, record.season)}</p>${record.sourceUrl ? sourceLinks([{ title: 'Source', url: record.sourceUrl }]) : ''}</section>`).join('')}</div></section>` : ''}
    ${(community.milestones ?? []).length ? `<section class="panel archive-milestones"><div class="panel-heading"><h2>Season stories</h2></div><ul>${community.milestones.map(milestone => `<li>${e(story(milestone.text, milestone.season))} <span class="muted">${e(milestone.season)}</span>${milestone.sourceUrl ? sourceLinks([{ title: 'Source', url: milestone.sourceUrl }]) : ''}</li>`).join('')}</ul></section>` : ''}
    <section class="panel documentation-links"><div class="panel-heading"><h2>Community journal & documentation</h2></div><div>${sourceLinks(community.documents)}</div></section>`;
}
