import { escapeHtml as e, playerRoute } from './model.mjs';
import { gameweekLabel, number, t } from './locale.mjs';

export function buildLineup(squad) {
  const ordered = [...squad].sort((a, b) => a.slot - b.slot);
  const starters = ordered.filter(player => !player.bench);
  const rows = [['FWD', 'Forwards'], ['MID', 'Midfielders'], ['DEF', 'Defenders'], ['GK', 'Goalkeeper']]
    .map(([position, label]) => ({ position, label, players: starters.filter(player => player.position === position) }));
  const unknown = starters.filter(player => !rows.some(row => row.position === player.position));
  if (unknown.length) rows.push({ position: '—', label: 'Unspecified position', players: unknown });
  const formation = starters.length === 11 && rows[3].players.length === 1 && !unknown.length
    ? [rows[2], rows[1], rows[0]].map(row => row.players.length).join('-') : null;
  return { rows: rows.filter(row => row.players.length), bench: ordered.filter(player => player.bench), formation };
}

const points = player => number(player.points);
const shirt = '<svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="m13 7-8 5 4 9 5-2v16h12V19l5 2 4-9-8-5c-1 4-3 5-7 5s-6-1-7-5Z" fill="currentColor"/><path d="M16 8c0 5 8 5 8 0" stroke="#17231b" stroke-width="2"/></svg>';

export function handleHeadshotError(event) {
  const image = event.target;
  if (!image?.matches?.('img.player-headshot')) return;
  const fallback = image.dataset?.fallbackSrc;
  if (fallback) {
    delete image.dataset.fallbackSrc;
    image.src = fallback;
  } else image.remove();
}

export function renderPlayerAvatar(photoCode, goalkeeper = false) {
  const photo = Number.isSafeInteger(photoCode) && photoCode > 0
    ? `<img class="player-headshot" src="https://resources.premierleague.com/premierleague25/photos/players/110x140/${photoCode}.png" data-fallback-src="https://resources.premierleague.com/premierleague/photos/players/250x250/p${photoCode}.png" alt="" width="72" height="72" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
  return `<span class="player-avatar${goalkeeper ? ' goalkeeper' : ''}" aria-hidden="true">${shirt}${photo}</span>`;
}

const pitchEvents = [
  ['goals', 'Goals', '<circle cx="12" cy="12" r="10.5"/><path class="pitch-icon-detail" d="m12 7 5 3.6-2 5.9H9l-2-5.9zM8 3.5 12 2l4 1.5-4 2zM2.6 10l3-3.2-.4 5-2.6 1.6zm18.8 0-3-3.2.4 5 2.6 1.6zM5.6 18l4.2.3 1.4 3.3-4.4-1.5zm12.8 0-4.2.3-1.4 3.3 4.4-1.5z"/>'],
  ['assists', 'Assists', '<g transform="rotate(-18 12 12)"><path d="M2 8.5c0-1 .6-1.5 1.4-1.5l2.3 1.7c1.5.9 3.2.3 4.2-1.8l1.2-2 2.4 1.3c.3 3.5 2.9 5.5 6.7 6.6 1.6.4 2.5 1.5 2.5 3 0 1.2-1.4 2-3.3 2H2zm1.5 10h3v2.2h-3zm5 0H11v2H8.5zm8.5 0h3v2h-3z"/><path class="pitch-icon-detail" d="m11 8.7 3-1 .6 1.5-3 1zm2 2.5 3-1 .6 1.5-3 1z"/></g>'],
  ['cleanSheets', 'Clean sheets', '<path d="M7 17c-1.4-1-2.8-3.1-4.8-6.3-.9-1.5.8-2.9 2-1.8L7 11.5l-1-7c-.3-1.9 2.2-2.3 2.5-.5l1 5.5h.7l-.6-7c-.2-1.9 2.5-2.1 2.7-.2l.6 7h.7l.2-6.6c.1-1.8 2.6-1.7 2.6.1l-.2 6.8.7.1.9-4.6c.4-1.7 2.8-1.3 2.5.5l-1.2 7.1c-.3 2-1 3.3-2.2 4.5H7zm.1 1.5h10.2V22H7.1z"/>']
];

function playerToken(player, key, topScore) {
  const score = player.points;
  const scoreClass = score == null ? 'unknown' : score <= 2 ? 'red' : score <= 5 ? 'yellow' : score <= 9 ? 'green' : 'blue';
  const star = Number.isFinite(score) && score === topScore ? `<span class="pitch-star" role="img" aria-label="${t("Top scorer")}" title="${t("Top scorer")}">★</span>` : '';
  const events = pitchEvents.map(([field, label, icon]) => {
    if (field === 'cleanSheets' && player.position === 'FWD') return '';
    const count = player[field];
    if (!Number.isSafeInteger(count) || count < 1) return '';
    const description = `${t(label)}: ${number(count)}`;
    return `<span class="pitch-event ${field}" role="img" aria-label="${description}" title="${description}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${icon}</svg>${number(count)}</span>`;
  }).join('');
  return `<li class="pitch-player"><a href="${playerRoute(player.id, player.photoCode, key)}"><span class="pitch-portrait">${renderPlayerAvatar(player.photoCode, player.position === 'GK')}<span class="pitch-score ${scoreClass}"><span class="sr-only">${t("Gameweek points: ")}</span>${points(player)}<span class="sr-only">${t(" points")}</span>${star}</span>${events}</span><strong class="pitch-player-name" title="${e(player.name)}">${e(player.name)}</strong><span class="pitch-player-club">${e(player.club)}<span class="sr-only"> · ${e(t(player.position))}</span></span></a></li>`;
}

export function renderLineup(team, key = 'D') {
  const manager = team.manager || t("Manager not available");
  const coach = `<section class="head-coach"><span class="coach-avatar" aria-hidden="true">${e(manager.split(/\s+/).slice(0, 2).map(word => word[0]).join(''))}</span><div><h3>${t("Head Coach")}</h3><strong>${e(manager)}</strong></div></section>`;
  if (!team.squad?.length) return `<section class="panel squad-panel"><div class="panel-heading"><h2>${t("Lineup")}</h2><span class="subtle-label">${t("Awaiting first sync")}</span></div><div class="empty-pitch"><div class="pitch-center"></div><div class="pitch-message"><span aria-hidden="true">♧</span><h2>${t("The lineup is on its way")}</h2><p>${t("Players and gameweek points will appear after")}<br>${t("the first successful squad sync.")}</p></div></div>${coach}</section>`;
  const lineup = buildLineup(team.squad);
  const topScore = Math.max(...team.squad.filter(player => !player.bench && Number.isFinite(player.points)).map(player => player.points));
  const playerRows = players => players.map(player => `<tr><td><span class="position-tag">${e(t(player.position))}</span></td><td><a href="${playerRoute(player.id, player.photoCode, key)}"><strong>${e(player.name)}</strong></a><small class="player-club">${e(player.club)}</small></td><td class="numeric points-cell">${points(player)}</td></tr>`).join('');
  return `<section class="panel squad-panel"><div class="panel-heading"><h2>${t("Lineup")} <span class="formation-tag">${e(lineup.formation ?? t("Starting XI"))}</span></h2><span class="tiny-accent">${team.squadGameweek ? gameweekLabel(e(team.squadGameweek)) : t("Saved squad")}</span></div>
    <div class="lineup-pitch"><div class="field-markings" aria-hidden="true"><span class="field-circle"></span><span class="field-box"></span><span class="field-goal"></span></div><div class="formation-rows">${lineup.rows.map(row => `<ul class="pitch-row" aria-label="${e(t(row.label))}">${row.players.map(player => playerToken(player, key, topScore)).join('')}</ul>`).join('')}</div></div>
    <div class="bench-heading"><h3>${t("Bench")}</h3><span>${t("Not included in the starting XI")}</span></div><ul class="bench-players" aria-label="${t("Substitutes in bench order")}">${lineup.bench.map(player => playerToken(player, key)).join('')}</ul>
    ${coach}
    <p class="lineup-note">${lineup.formation ? t("Formation {0} · ", e(lineup.formation)) : ''}${t("Arranged by FPL position. Exact left/right roles are not supplied.")}</p>
    <details class="squad-details quiet-disclosure"><summary>${t("View player list")}</summary><table class="squad-table"><caption class="sr-only">${t("Starting eleven and bench, with individual gameweek points")}</caption><thead><tr><th scope="col">POS</th><th scope="col">${t("Player")}</th><th scope="col" class="numeric">PTS</th></tr></thead><tbody><tr class="group-row"><th colspan="3" scope="rowgroup">${t("Starting XI")}</th></tr>${playerRows(team.squad.filter(player => !player.bench))}<tr class="group-row"><th colspan="3" scope="rowgroup">${t("Bench")}</th></tr>${playerRows(lineup.bench)}</tbody></table></details>
    <p class="panel-copy">${t("Numbers on players are FPL points, not match ratings. — means points are unavailable.")}</p></section>`;
}
