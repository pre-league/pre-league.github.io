import { escapeHtml as e, newestTransactionFirst, playerRoute } from './model.mjs';
import { gameweekLabel, leagueLabel, number, t } from './locale.mjs';
import { renderPlayerAvatar } from './lineup.mjs';

export function playerSeason(weeks, id, key, teams) {
  const totals = new Map();
  const history = Object.entries(weeks).sort(([a], [b]) => Number(b) - Number(a)).map(([gw, week]) => {
    const squads = week.squads[key] ?? {};
    const points = week.points[id] ?? null;
    for (const [entry, picks] of Object.entries(squads)) {
      const pick = picks.find(([player]) => player === id);
      if (!pick) continue;
      const teamId = Number(entry);
      const row = totals.get(teamId) ?? { teamId, weeks: 0, starts: 0, points: 0, bench: 0, known: 0 };
      row.weeks++;
      const used = pick[1] > 0;
      if (used) row.starts++;
      const credited = used && points == null ? null : (points ?? 0) * pick[1];
      if (credited != null) { row.known++; row.points += credited; }
      if (!used) row.bench = row.bench == null || points == null ? null : row.bench + points;
      totals.set(teamId, row);
      return { gw, points, teamId, used, credited };
    }
    const complete = teams.length > 0 && teams.every(team => squads[team.id]);
    return { gw, points, complete };
  });
  const clubs = [...totals.values()].map(row => {
    const complete = row.known === row.weeks;
    return { ...row, points: complete ? row.points : null, average: complete && row.starts > 0 ? row.points / row.starts : null };
  }).sort((a, b) => (b.points ?? -Infinity) - (a.points ?? -Infinity) || b.average - a.average);
  return { clubs, history };
}

export function renderPlayer(data, snapshot, config, params, key, teamLink) {
  const photo = Number(params.get('photo'));
  const id = params.has('id') ? Number(params.get('id')) :
    Number(Object.keys(data.players).find(k => photo > 0 && data.players[k].photoCode === photo));
  const player = data.players[id];
  if (!player) return { name: t("Player"), html: `<p class="no-results">${t("Player not found")}</p>` };
  const base = playerRoute(id, null, key);
  const tab = ['stats', 'history'].includes(params.get('section')) ? params.get('section') : 'overview';
  const league = snapshot.divisions[key];
  const teams = league?.teams ?? [];
  const clubCell = (entry, detail) => {
    const team = teams.find(team => team.id === entry);
    return team ? teamLink(team, key, config.season, detail) : e(t("Entry {0}", entry));
  };
  const { clubs, history } = playerSeason(data.weeks, id, key, teams);
  const panel = (title, body) => `<section class="panel"><div class="panel-heading"><h2>${t(title)}</h2></div>${body}</section>`;
  const table = (title, headings, rows) => panel(title, rows.length ? `<div class="stats-table-scroll" role="region" aria-label="${t(title)}" tabindex="0"><table><thead><tr>${headings.map(h => `<th scope="col">${t(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="panel-copy">${t("No records in this league.")}</p>`);
  const select = '<div class="stats-toolbar">' + leagueSelect(config, key) + '</div>';
  const header = `<header class="team-hero player-heading">${renderPlayerAvatar(player.photoCode, player.position === 'GK')}<div><h1>${e(player.fullName || player.name)}</h1><p>${[player.club, t(player.position), config.season].filter(Boolean).map(e).join(' &middot; ')}</p></div></header>
    <nav class="section-nav" aria-label="${t("Player sections")}">${[['overview','Overview'],['stats','Stats'],['history','History']].map(([section,label]) => `<a href="${base}&section=${section}"${tab === section ? ' aria-current="page"' : ''}>${t(label)}</a>`).join('')}</nav>`;
  let content;
  if (tab === 'overview') {
    content = panel("Ownership", config.divisions.map(({ key: division }) => {
      const owner = data.owners?.[division]?.[id];
      const team = snapshot.divisions[division]?.teams.find(team => team.id === owner);
      return `<div class="identity-row"><a href="#league=${e(division)}">${leagueLabel(e(division))}</a><span>${team ? teamLink(team, division) : owner === null ? t("Free agent") : owner ? e(t("Entry {0}", owner)) : t("Unavailable")}</span></div>`;
    }).join(''));
  } else if (tab === 'stats') {
    const metrics = [['Season points','points'],['Minutes','minutes'],['Goals','goals'],['Assists','assists'],['Clean sheets','cleanSheets'],['Bonus points','bonus']];
    content = panel("Season stats", `<dl class="player-metrics">${metrics.map(([label,field]) => `<div><dt>${t(label)}</dt><dd>${number(player[field])}</dd></div>`).join('')}</dl>`) + select +
      table("Points by club", ["Club","Points","Avg / GW","Bench"], clubs.map(row => [
        clubCell(row.teamId, t(row.weeks === 1 ? "1 GW · {1} in XI" : "{0} GWs · {1} in XI", number(row.weeks), number(row.starts))),
        `<strong>${number(row.points)}</strong>`, number(row.average, {maximumFractionDigits: 1}), number(row.bench)
      ])) + `<p class="panel-copy">${t("Weekly average counts each gameweek in the scoring XI after automatic substitutions.")}</p>`;
  } else {
    const moves = (league?.transactions ?? []).flatMap(move => {
      const side = ['In','Out'].find(side => move['player' + side + 'Id'] === id || (player.photoCode > 0 && move['player' + side + 'PhotoCode'] === player.photoCode));
      return side ? [{ ...move, side }] : [];
    }).sort(newestTransactionFirst);
    content = select + table("Gameweek history", ["GW","Club","Selection","Player pts","Points for club"], history.map(w => [
      number(Number(w.gw)), w.teamId ? clubCell(w.teamId) : w.complete ? t("Free agent") : t("Unavailable"),
      w.teamId ? t(w.used ? "Scoring XI" : "Bench") : number(null), number(w.points), number(w.credited)
    ])) + (Array.isArray(league?.transactions) ? table("Transfers", ["GW","Club","Move"], moves.map(m => [
      gameweekLabel(m.gameweek), clubCell(m.teamId), e(t(m.side)) + ' &middot; ' + e(t(m.kind))
    ])) : panel("Transfers", `<p class="panel-copy">${t("Transfers unavailable.")}</p>`));
  }
  return { name: player.fullName || player.name, html: header + `<div class="player-content">${content}</div>` };
}

function leagueSelect(config, key, includeAll = false) {
  return `<div class="control-field"><label for="player-league">${t("League")}</label><select id="player-league">${includeAll ? `<option value="all"${key == null ? ' selected' : ''}>${t("All leagues")}</option>` : ''}${config.divisions.map(d => `<option value="${e(d.key)}"${d.key === key ? ' selected' : ''}>${leagueLabel(e(d.key))}</option>`).join('')}</select></div>`;
}

const seasonMetrics = { points: 'Season points', goals: 'Goals', assists: 'Assists', bonus: 'Bonus points', cleanSheets: 'Clean sheets', minutes: 'Minutes' };
const clubMetrics = { average: 'Weekly average', points: 'Points for club', peak: 'Best week' };

export function superstarRows(data, league, teams) {
  const ids = new Set(Object.values(data.weeks).flatMap(week =>
    Object.values(week.squads[league] ?? {}).flatMap(picks => picks.map(([id]) => id))));
  return [...ids].flatMap(id => {
    const player = data.players[id];
    if (!player) return [];
    const { clubs, history } = playerSeason(data.weeks, id, league, teams);
    return clubs.filter(club => club.starts > 0).map(club => {
      const scores = history.filter(w => w.teamId === club.teamId && w.used && w.credited != null);
      return { ...club, league, id, player, peak: scores.length ? Math.max(...scores.map(w => w.credited)) : null };
    });
  });
}

export function renderPlayers(data, snapshot, config, params, league, badge) {
  const stars = params.get('section') !== 'season';
  const selectedLeague = config.divisions.find(d => d.key === params.get('league'))?.key;
  const metrics = stars ? clubMetrics : seasonMetrics;
  const metric = Object.hasOwn(metrics, params.get('metric')) ? params.get('metric') : (stars ? 'average' : 'points');
  const divisions = config.divisions.filter(d => !selectedLeague || d.key === selectedLeague);
  const rows = stars ? divisions.flatMap(d => superstarRows(data, d.key, snapshot.divisions[d.key]?.teams ?? [])) :
    Object.entries(data.players).map(([id, player]) => ({ id: Number(id), player, ...player }));
  rows.sort((a, b) => (b[metric] ?? -Infinity) - (a[metric] ?? -Infinity) || a.player.name.localeCompare(b.player.name));
  const term = params.get('q')?.trim() ?? '';
  const normalize = value => value.toLocaleLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  let rank = 0;
  const ranked = rows.map((row, i) => {
    if (!i || row[metric] !== rows[i - 1][metric]) rank = i + 1;
    return { ...row, rank: row[metric] == null ? null : rank };
  }).filter(row => stars || normalize([row.player.name, row.player.fullName, row.player.club].join(' ')).includes(normalize(term)));
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(ranked.length / pageSize));
  const page = Math.min(pages, Math.max(1, Math.floor(Number(params.get('p'))) || 1));
  const route = values => '#' + new URLSearchParams({ page: 'players', ...(selectedLeague && { league: selectedLeague }), ...values });
  const pageHref = p => {
    const next = new URLSearchParams(params);
    next.set('p', p);
    return '#' + next;
  };
  const filters = `<div class="stats-toolbar player-filters">${stars ? leagueSelect(config, selectedLeague, true) : ''}
    <div class="control-field"><label for="player-metric">${t("Sort by")}</label><select id="player-metric">${Object.entries(metrics).map(([key, label]) => `<option value="${key}"${metric === key ? ' selected' : ''}>${t(label)}</option>`).join('')}</select></div>
    ${stars ? '' : `<form id="find-player"><input type="search" name="q" aria-label="${t("Find a player")}" placeholder="${t("Find a player")}" value="${e(term)}"><button type="submit">${t("Search")}</button></form>`}</div>`;
  const columns = stars && metric !== 'average' ? [metric, 'average'] : stars ? ['average', 'points'] : [metric];
  const body = ranked.slice((page - 1) * pageSize, page * pageSize).map(row => {
    const { player } = row;
    const detail = stars ? t(row.starts === 1 ? '1 match played' : '{0} matches played', number(row.starts)) : [player.club, t(player.position)].filter(Boolean).map(e).join(' · ');
    const club = stars && snapshot.divisions[row.league]?.teams?.find(team => team.id === row.teamId);
    const clubCell = stars ? `<td><span class="star-club">${club ? badge(club) + '<span>' + e(club.name) + '</span>' : t("Entry {0}", row.teamId)}</span></td>` : '';
    return `<tr><td>${number(row.rank)}</td><td><a class="team-link" href="${playerRoute(row.id, null, row.league ?? league)}">${renderPlayerAvatar(player.photoCode, player.position === 'GK')}<span><strong>${e(player.name)}</strong><small>${detail}</small></span></a></td>${clubCell}${columns.map(key => `<td class="numeric">${number(row[key], { maximumFractionDigits: 1 })}</td>`).join('')}</tr>`;
  }).join('');
  const html = `<div class="page-heading"><h1>${t("Players")}</h1></div><nav class="section-nav" aria-label="${t("Player sections")}"><a href="${route({ section: 'superstars' })}"${stars ? ' aria-current="page"' : ''}>${t("Superstars")}</a><a href="${route({ section: 'season' })}"${stars ? '' : ' aria-current="page"'}>${t("Season stats")}</a></nav>
    ${filters}<section class="panel player-board${stars ? ' superstar-board' : ''}">${body ? `<table><caption class="sr-only">${stars ? (selectedLeague ? leagueLabel(e(selectedLeague)) : t("All leagues")) : t("Players")} · ${t(metrics[metric])}</caption><thead><tr><th scope="col" aria-label="${t("Rank")}">#</th><th scope="col">${t("Player")}</th>${stars ? `<th scope="col">${t("Club")}</th>` : ''}${columns.map(key => `<th scope="col" class="numeric">${t(metrics[key])}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>` : `<p class="no-results">${t(stars ? "No records in this league." : "No players found.")}</p>`}</section>
    ${pages > 1 ? `<nav class="board-pages" aria-label="${t("Leaderboard pages")}">${page > 1 ? `<a href="${e(pageHref(page - 1))}">${t("Previous")}</a>` : ''}<span>${number(page)} / ${number(pages)}</span>${page < pages ? `<a href="${e(pageHref(page + 1))}">${t("Next")}</a>` : ''}</nav>` : ''}`;
  return { name: t("Players"), html };
}
