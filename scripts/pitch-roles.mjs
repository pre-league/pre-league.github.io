const api = 'https://footballapi.pulselive.com/football/';

async function get(path) {
  const response = await fetch(api + path, {
    headers: { Origin: 'https://www.premierleague.com' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`Premier League roles: HTTP ${response.status}`);
  return response.json();
}

const roleNames = {
  'Central Defender': 'CB', 'Full Back': 'FB', 'Wing Back': 'WB',
  'Defensive Midfielder': 'DM', 'Central Midfielder': 'CM',
  'Attacking Midfielder': 'AM', 'Midfielder': 'M', 'Winger': 'W',
  'Striker': 'ST', 'Second Striker': 'ST', 'Forward': 'F'
};

export function roleCode(description = '') {
  const [, sides, name] = /^(?:((?:Left|Centre|Right)(?:\/(?:Left|Centre|Right))*) )?(.+)$/.exec(description) ?? [];
  const role = roleNames[name];
  if (!role) return;
  const left = sides?.includes('Left'), right = sides?.includes('Right');
  const side = left && !right ? 'L' : right && !left ? 'R' : '';
  if (!side && (role === 'M' || role === 'F')) return;
  return side + role;
}

export async function refreshPitchRoles(season, cached, now, request = get) {
  if (cached && Date.parse(now) - Date.parse(cached.updatedAt) < 7 * 86400000) return cached;
  try {
    const { content } = await request('competitions/1/compseasons?pageSize=5');
    const year = Number(season.slice(0, 4));
    const entry = content.find(s => [season, `${year}/${year + 1}`].includes(s.label?.split(' ').at(-1)));
    if (!Number.isInteger(entry?.id)) throw new Error(`Missing Premier League season ${season}`);
    const page = n => request(`players?compSeasons=${entry.id}&altIds=true&pageSize=200&page=${n}`);
    const first = await page(0);
    const count = first.pageInfo.numPages;
    if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Unexpected player page count');
    const rest = await Promise.all(Array.from({ length: count - 1 }, (_, i) => page(i + 1)));
    const byCode = {};
    for (const batch of [first, ...rest]) {
      for (const player of batch.content) {
        const code = /^p([1-9]\d*)$/.exec(player.altIds?.opta)?.[1];
        const role = roleCode(player.info?.positionInfo);
        if (code && role) byCode[code] = role;
      }
    }
    if (!Object.keys(byCode).length) throw new Error('No detailed player positions returned');
    // Verified primary and alternate roles from the players' FotMob profiles.
    if (byCode[466075] === 'LFB') byCode[466075] = ['LFB', 'CB'];
    if (byCode[430871] === 'LST') byCode[430871] = ['LW', 'AM', 'ST']; // Cunha
    if (byCode[614071] === 'CM') byCode[614071] = ['DM', 'CM', 'AM', 'LW']; // Manzambi
    return { updatedAt: now, byCode };
  } catch (error) {
    console.warn(`Pitch role refresh skipped: ${error.message}`);
    return cached;
  }
}
