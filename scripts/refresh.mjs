import { normalizeLeague, normalizeSquad, normalizeTransactions } from '../src/model.mjs';
import { collectWeeklyRecords } from '../src/stats.mjs';

export async function refreshData(config, previous, getJson, now) {
  for (const division of config.divisions) {
    if (!/^[A-D]$/.test(division.key) || (division.leagueId !== null && (!Number.isSafeInteger(division.leagueId) || division.leagueId < 1))) {
      throw new Error('Invalid division configuration');
    }
  }
  const result = { season: config.season, lastAttemptAt: now, divisions: {}, history: previous.history ?? [], weekly: previous.season && previous.season !== config.season ? {} : previous.weekly ?? {}, errors: [] };
  const [gameResult, catalogResult] = await Promise.allSettled([getJson('game'), getJson('bootstrap-static')]);
  const candidate = gameResult.status === 'fulfilled' ? gameResult.value.current_event : null;
  const gameweek = Number.isSafeInteger(candidate) && candidate > 0 && candidate <= 38 ? candidate : null;
  const catalog = catalogResult.status === 'fulfilled' ? catalogResult.value : null;
  const live = gameweek ? await getJson(`event/${gameweek}/live`).catch(() => null) : null;

  for (const division of config.divisions.filter(d => d.leagueId !== null)) {
    const old = previous.divisions?.[division.key];
    let league;
    try {
      league = normalizeLeague(await getJson(`league/${division.leagueId}/details`), division.leagueId);
    } catch {
      result.errors.push(`League ${division.key} standings could not be refreshed.`);
      if (old?.leagueId === division.leagueId) result.divisions[division.key] = { ...old, stale: true };
      continue;
    }
    Object.assign(league, { updatedAt: now, source: 'api', stale: false, gameweek, warnings: [] });
    if (gameweek && catalog) {
      await Promise.all(league.teams.map(async team => {
        try {
          const selection = await getJson(`entry/${team.id}/event/${gameweek}`);
          team.squad = normalizeSquad(selection, catalog, live);
          if (team.squad.length === 0) throw new Error('Empty squad');
          team.squadGameweek = gameweek;
          const benchPoints = selection.entry_history?.points_on_bench;
          team.benchPoints = Number.isSafeInteger(benchPoints) ? benchPoints : null;
        } catch {
          league.warnings.push(`${team.name}'s squad is unavailable.`);
        }
      }));
      if (!live) league.warnings.push('Player gameweek points are unavailable.');
    } else {
      league.warnings.push('Squads await a valid gameweek and player catalog.');
    }
    try {
      league.transactions = normalizeTransactions(await getJson(`draft/league/${division.leagueId}/transactions`), league.teams, catalog);
    } catch {
      if (previous.season === config.season && old?.leagueId === league.leagueId && Array.isArray(old.transactions)) {
        league.transactions = old.transactions;
        league.transactionsStale = true;
      }
      league.warnings.push('Published transactions are unavailable from the public API.');
    }
    result.divisions[division.key] = league;
  }
  result.weekly = collectWeeklyRecords(result);
  return result;
}
