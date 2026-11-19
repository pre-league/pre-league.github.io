import { weekControl } from './gameweek.mjs';
import { escapeHtml as e } from './model.mjs';
import { gameweekLabel, leagueLabel, number, teamCount, t } from './locale.mjs';
import { combinedWeeklyRecords, weeklyAwards } from './stats.mjs';
import { clubForTeam, clubBrandTeam, clubRoute } from './clubs.mjs';

const sourceLinks = sources => (sources ?? []).map(source => `<a class="source-link" href="${e(source.url)}" target="_blank" rel="noopener noreferrer">${e(t(source.title))} ↗</a>`).join('');

export const leagueEmblem = key => `<span class="division-icon" aria-hidden="true"><span class="division-letter">${e(key)}</span><img class="league-emblem" src="./assets/league/thumbs/${e(key)}.webp" alt="" width="48" height="48" decoding="async"></span>`;

export function renderWelcome(config, latest) {
  return `<section class="welcome"><h1>${t("Divisions")}</h1><span>${e(config.season)}</span></section>
    <section class="panel identity-list welcome-divisions" aria-label="${t("Choose a division")}">${config.divisions.map(division => {
      const league = latest.divisions[division.key];
      const leader = league?.teams[0];
      const status = !league ? (division.leagueId ? t("Awaiting sync") : t("Coming soon")) : league.source === "documentation" ? t("Published GW {0}", league.gameweek) : [league.gameweek && gameweekLabel(league.gameweek), league.stale ? t("Saved standings · refresh failed") : league.source === "provided" ? t("Sample standings") : t("Saved standings")].filter(Boolean).join(" · ");
      return `<a class="identity-row" href="#league=${division.key}"><span class="team-link">${leagueEmblem(division.key)}<span><strong>${leagueLabel(division.key)}</strong><small>${leader ? e(leader.name) : status}</small></span></span>${leader ? `<span class="identity-value"><strong>${t("{0} pts", number(leader.total))}</strong><small>${status}</small></span>` : '<span class="accent" aria-hidden="true">→</span>'}</a>`;
    }).join('')}</section>`;
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
  const leaderboard = [...awards.teams].sort((a, b) => (b.gameweekPoints ?? -Infinity) - (a.gameweekPoints ?? -Infinity));
  const ranks = new Map();
  leaderboard.forEach(({ gameweekPoints }, index) => {
    if (Number.isSafeInteger(gameweekPoints) && !ranks.has(gameweekPoints)) ranks.set(gameweekPoints, index + 1);
  });
  const coverage = `${awards.divisions.length}/${divisionCount}`;
  const reports = !historic && community.currentSeason === config.season ? community.reports ?? [] : [];
  const report = reports.find(report => report.gameweek === gameweek && report.season === season);
  const documented = Object.values(weekly[gameweek] ?? {}).some(division => division.source === 'documentation');
  function awardRow(title, description, award, style) {
    return `<section class="award-row ${style}"><details class="quiet-disclosure award-details"><summary><h3 class="award-label">${t(title)}</h3>${award.winners.length > 1 ? `<span class="award-tie">${t("Joint winners")}</span>` : ''}</summary><p class="award-definition">${t(description)}</p></details>
      <div class="award-result"><div class="award-winners">${award.winners.length ? award.winners.map(team => `<div>${teamLink(team, team.division, season)}<span class="award-division">${leagueLabel(e(team.division))}</span></div>`).join('') : `<p>${t("No scores available yet.")}</p>`}</div><strong class="award-score">${number(award.value)}<span>${t("points")}</span></strong></div>
      ${style === 'bench-award' && awards.teams.length ? `<p class="award-coverage">${t("Bench scores: {0}/{1} teams", award.knownTeams, awards.teams.length)}</p>` : ''}</section>`;
  }
  return `<div class="page-heading"><h1>${t("Gameweek stats")}</h1></div><div class="stats-toolbar"><div class="control-field"><label for="stats-season">${t("Season")}</label><select id="stats-season">${seasons.map(value => `<option value="${e(value)}"${value === season ? ' selected' : ''}>${e(value)}</option>`).join('')}</select></div>${weeks.length ? `${weekControl('gameweek', 'Gameweek', weeks, gameweek)}<span>${teamCount(awards.teams.length)}</span>` : ''}</div>${weeks.length ? '' : `<p class="notice">${t("No gameweek data has been saved yet. Awards will appear after a successful sync.")}</p>`}
    ${weeks.length && awards.divisions.length < divisionCount ? `<p class="notice">${t("Partial coverage: {0} {1} have saved scores for GW {2} ({3}). Winners may change when the other divisions are connected.", coverage, t(historic ? 'leagues' : 'divisions'), gameweek, awards.divisions.join(', '))}</p>` : ''}
    <section class="panel weekly-awards"><div class="panel-heading"><h2>${gameweek ? t("Gameweek {0}", gameweek) + " · " : ""}${t("Awards")}</h2></div>${awardRow('Week’s MVP', 'Most team points this gameweek, across all leagues.', awards.mvp, 'mvp-award')}${awardRow('Absolute Leader', 'Most season points at this gameweek, across all leagues.', awards.leader, 'leader-award')}${awardRow('Unlucky', 'Most points left on the bench this gameweek.', awards.unlucky, 'bench-award')}</section>
    ${awards.teams.length ? `<section class="panel stats-ranking"><div class="panel-heading"><h2>${t("Gameweek leaderboard")}</h2><span class="subtle-label">${gameweekLabel(gameweek)}</span></div><div class="stats-table-scroll" role="region" aria-label="${t("Gameweek leaderboard")}" tabindex="0"><table><caption class="sr-only">${t("All available teams for gameweek {0}", gameweek)}</caption><thead><tr><th scope="col"><span aria-hidden="true">#</span><span class="sr-only">${t("Rank")}</span></th><th scope="col">${t("Team")}</th><th scope="col">${t("League")}</th><th scope="col" class="numeric">${t("GW")}</th><th scope="col" class="numeric">${t("Total")}</th><th scope="col" class="numeric">${t("Bench")}</th></tr></thead><tbody>${leaderboard.map(team => `<tr><td class="rank-col">${number(ranks.get(team.gameweekPoints))}</td><td>${teamLink(team, team.division, season)}</td><td>${team.division}</td><td class="numeric">${number(team.gameweekPoints)}</td><td class="numeric">${number(team.totalPoints)}</td><td class="numeric">${number(team.benchPoints)}</td></tr>`).join('')}</tbody></table></div></section><details class="quiet-disclosure score-notes"><summary>${t("Points that count")}</summary><p class="panel-copy">${t("Saved gameweek scores · — means unavailable. Shared scores keep all joint winners. ")}${historic ? t("Historical scores come from the completed season workbook.") : t("Awards update with each successful daily sync.")}</p></details>` : ''}
    ${awards.unlucky.knownTeams < awards.teams.length ? `<p class="archive-note">${t("Unlucky compares known bench scores, including published award scores. Other bench totals are unavailable.")}</p>` : ''}
    ${documented ? `<p class="notice">${t("Includes published {0} scores.", t(historic ? 'workbook' : 'journal'))} ${e(t(historic?.scoreMethod ?? community.scoreMethod ?? ''))}${historic ? '' : t(" API scores take priority where available.")}</p>` : ''}
    ${historic ? `<div class="archive-sources">${sourceLinks(historic.sources)}</div>` : ''}
    ${report ? `<details class="panel journal-report quiet-disclosure"><summary>${gameweekLabel(gameweek)} · ${e(report.title)}</summary><article lang="pt-PT">${report.paragraphs.map(paragraph => `<p>${e(paragraph)}</p>`).join('')}</article>${sourceLinks([{ title: t("Read the original report"), url: report.sourceUrl }])}</details>` : ''}`;
}

export function renderArchive(community, teamLink, snapshot = {}) {
  const winner = (name, season) => {
    const club = clubForTeam(community, { name }, season);
    if (club && teamLink) return teamLink({ name, manager: club.manager, id: null }, '', season);
    return club ? `<a href="${clubRoute(club.key, season)}">${e(name)}</a>` : e(name);
  };
  const story = (text, season) => text.replace(/\b\w+\b/g, name => clubBrandTeam(community, snapshot, { name }, season).name);
  return `<div class="page-heading"><h1>${t("Record book")}</h1></div>
    ${(community.seasons ?? []).map(season => `<section class="season-section"><div class="season-heading"><h2>${e(season.season)}</h2><span>${t("{0} standalone leagues", Object.keys(season.leagues).length)}</span></div>
      ${(season.notes ?? []).map(note => `<p class="archive-note">${e(t(note))}</p>`).join('')}
      <ul class="panel identity-list archive-champions" role="list">${Object.entries(season.champions ?? {}).map(([key, name]) => `<li class="identity-row"><span>${t("League {0} champion", e(key))}</span><strong>${winner(name, season.season)}</strong></li>`).join('')}</ul>
      ${(season.competitions ?? []).map(competition => `<section class="panel archive-competition"><div class="panel-heading"><h3>${e(competition.name)}</h3></div><ol>${competition.podium.map(team => `<li value="${team.rank}">${winner(team.name, season.season)}</li>`).join('')}</ol></section>`).join('')}
      <div class="archive-sources">${sourceLinks(season.sources)}</div></section>`).join('')}
    ${(community.records ?? []).length ? `<section class="season-section"><div class="season-heading"><h2>${t("Record book")}</h2></div><div class="panel identity-list archive-records">${community.records.map(record => `<article class="identity-row record-row">
      <div><h3>${e(t(record.label))}</h3>${winner(record.holder, record.season)}</div><div class="identity-value"><strong>${number(record.value)} <small>${e(t(record.unit))}</small></strong><small>${e(record.season)}</small>${record.sourceUrl ? sourceLinks([{ title: 'Source', url: record.sourceUrl }]) : ''}</div></article>`).join('')}</div></section>` : ''}
    ${(community.milestones ?? []).length ? `<section class="panel archive-milestones"><div class="panel-heading"><h2>${t("Season stories")}</h2></div><ul>${community.milestones.map(milestone => `<li>${e(story(t(milestone.text), milestone.season))} <span class="muted">${e(milestone.season)}</span>${milestone.sourceUrl ? sourceLinks([{ title: 'Source', url: milestone.sourceUrl }]) : ''}</li>`).join('')}</ul></section>` : ''}
    <section class="panel documentation-links"><div class="panel-heading"><h2>${t("Community journal & documentation")}</h2></div><div>${sourceLinks(community.documents)}</div></section>`;
}
