const integer = (value, label, min = -Infinity) => {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`Invalid ${label}`);
  return value;
};
const text = (value, label) => {
  if (typeof value !== 'string' || value.length > 500) throw new Error(`Invalid ${label}`);
  return value;
};
const playerPhotoCode = player => Number.isSafeInteger(player?.code) && player.code > 0 ? player.code : null;

export function normalizeLeague(data, expectedId) {
  if (data?.league?.id !== expectedId || !Array.isArray(data.league_entries) || !Array.isArray(data.standings)) {
    throw new Error('Invalid league response');
  }
  integer(expectedId, 'league ID', 1);
  if (data.league.scoring !== 'c') throw new Error('Only total-points leagues are supported');
  const entries = new Map();
  const publicIds = new Set();
  for (const entry of data.league_entries) {
    integer(entry.id, 'league entry', 1);
    integer(entry.entry_id, 'entry ID', 1);
    if (entries.has(entry.id) || publicIds.has(entry.entry_id)) throw new Error('Duplicate team');
    entries.set(entry.id, entry);
    publicIds.add(entry.entry_id);
  }
  const seen = new Set();
  const teams = data.standings.map(row => {
    const entry = entries.get(row.league_entry);
    if (!entry || seen.has(row.league_entry)) throw new Error('Invalid standings relationship');
    seen.add(row.league_entry);
    return {
      id: entry.entry_id, leagueEntryId: entry.id,
      name: text(entry.entry_name, 'team name'),
      manager: `${text(entry.player_first_name, 'first name')} ${text(entry.player_last_name, 'last name')}`.trim(),
      initials: text(entry.short_name, 'initials'),
      rank: integer(row.rank, 'rank', 1), lastRank: integer(row.last_rank, 'last rank', 0),
      total: integer(row.total, 'total'), eventPoints: integer(row.event_total, 'gameweek points'),
      waiverPick: entry.waiver_pick == null ? null : integer(entry.waiver_pick, 'waiver priority', 1),
      squad: null, squadGameweek: null
    };
  }).sort((a, b) => a.rank - b.rank || b.total - a.total);
  return { leagueId: expectedId, name: text(data.league.name, 'league name'), teams, transactions: null };
}

export function normalizeSquad(data, bootstrap, live) {
  if (!Array.isArray(data?.picks) || !Array.isArray(bootstrap?.elements) || data.picks.length > 15) throw new Error('Invalid squad response');
  const players = new Map(bootstrap.elements.map(player => [player.id, player]));
  const clubs = new Map((bootstrap.teams ?? []).map(club => [club.id, club.short_name ?? club.name]));
  const livePlayers = Array.isArray(live?.elements)
    ? Object.fromEntries(live.elements.map(player => [player.id, player])) : live?.elements ?? {};
  const seen = new Set();
  const slots = new Set();
  return data.picks.map(pick => {
    integer(pick.element, 'player ID', 1);
    integer(pick.position, 'squad slot', 1);
    const player = players.get(pick.element);
    if (!player || pick.position > 15 || seen.has(player.id) || slots.has(pick.position)) throw new Error('Invalid squad player');
    seen.add(player.id); slots.add(pick.position);
    const points = livePlayers[player.id]?.stats?.total_points;
    return {
      id: player.id, name: text(player.web_name, 'player name'),
      photoCode: playerPhotoCode(player),
      position: ({ 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' })[player.element_type] ?? '—',
      club: text(clubs.get(player.team) ?? '—', 'club'),
      slot: pick.position, bench: pick.position > 11,
      points: points == null ? null : integer(points, 'player points')
    };
  }).sort((a, b) => a.slot - b.slot);
}

export const newestTransactionFirst = (a, b) => b.gameweek - a.gameweek || b.id - a.id;

export function normalizeTransactions(data, teams, bootstrap) {
  const rows = Array.isArray(data) ? data : data?.transactions;
  if (!Array.isArray(rows)) throw new Error('Invalid transaction response');
  const players = new Map((Array.isArray(bootstrap?.elements) ? bootstrap.elements : []).map(player => [player.id, player]));
  const owners = new Set(teams.map(team => team.id));
  const draftRank = player => Number.isSafeInteger(player?.draft_rank) && player.draft_rank > 0 ? player.draft_rank : null;
  const points = player => Number.isSafeInteger(player?.total_points) ? player.total_points : null;
  return rows.filter(row => row.result === 'a').map(row => {
    if (!owners.has(row.entry)) throw new Error('Unknown transaction owner');
    const inId = integer(row.element_in, 'incoming player', 1);
    const outId = integer(row.element_out, 'outgoing player', 1);
    const incoming = players.get(inId), outgoing = players.get(outId);
    return {
      id: integer(row.id, 'transaction ID', 1), teamId: row.entry,
      gameweek: integer(row.event, 'transaction gameweek', 1),
      playerInId: inId, playerOutId: outId,
      playerIn: text(incoming?.web_name ?? `Player ${inId}`, 'incoming name'),
      playerOut: text(outgoing?.web_name ?? `Player ${outId}`, 'outgoing name'),
      playerInPhotoCode: playerPhotoCode(incoming), playerOutPhotoCode: playerPhotoCode(outgoing),
      playerInDraftRank: draftRank(incoming), playerOutDraftRank: draftRank(outgoing),
      playerInPoints: points(incoming), playerOutPoints: points(outgoing),
      kind: row.kind === 'w' ? 'Waiver' : row.kind === 'f' ? 'Free agent' : 'Transfer'
    };
  }).sort(newestTransactionFirst);
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function sameManager(first, second) {
  const a = first?.trim(), b = second?.trim();
  return Boolean(a && b) && a.localeCompare(b, 'pt', { sensitivity: 'base' }) === 0;
}

export function standingPlace(division, position, teamCount) {
  if (division === 'A' && position === 1) return 'trophy';
  if (division !== 'A' && position <= 2) return 'promotion';
  if (division !== 'D' && position > teamCount - 2) return 'relegation';
  return null;
}

export function playerRoute(id, photo, league) {
  const identity = Number.isSafeInteger(id) && id > 0 ? { id } : Number.isSafeInteger(photo) && photo > 0 ? { photo } : null;
  return identity ? `#${new URLSearchParams({ page: 'player', ...identity, league })}` : '';
}
