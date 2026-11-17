export function collectWeeklyRecords(snapshot) {
  const weekly = structuredClone(snapshot.weekly ?? {});
  for (const [division, league] of Object.entries(snapshot.divisions ?? {})) {
    const gameweek = league.gameweek;
    if (!/^[A-D]$/.test(division) || league.stale || league.source !== 'api' || !Number.isInteger(gameweek) || gameweek < 1 || gameweek > 38) continue;
    const teams = league.teams.map(team => {
      const bench = team.squadGameweek === gameweek ? team.squad?.filter(player => player.bench) : null;
      const benchPoints = Number.isSafeInteger(team.benchPoints) ? team.benchPoints : bench?.length === 4 && bench.every(player => Number.isSafeInteger(player.points))
        ? bench.reduce((sum, player) => sum + player.points, 0) : null;
      return { id: team.id, name: team.name, manager: team.manager, division, gameweekPoints: team.eventPoints, totalPoints: team.total, benchPoints };
    });
    weekly[gameweek] = { ...weekly[gameweek], [division]: { updatedAt: league.updatedAt, teams } };
  }
  return weekly;
}

export function combinedWeeklyRecords(snapshot, community, season) {
  const weekly = structuredClone(community.currentSeason === season ? community.weekly ?? {} : {});
  for (const [week, divisions] of Object.entries(collectWeeklyRecords(snapshot))) {
    weekly[week] = { ...weekly[week], ...divisions };
  }
  return weekly;
}

export function documentedDivision(community, key, season) {
  if (community.currentSeason !== season) return null;
  const week = Object.keys(community.weekly ?? {}).map(Number).filter(week => community.weekly[week][key]?.teams.length).sort((a, b) => b - a)[0];
  if (!week) return null;
  const report = community.weekly[week][key];
  return {
    source: 'documentation', sourceUrl: report.sourceUrl, gameweek: week, updatedAt: null,
    name: `League ${key}`, transactions: null,
    teams: [...report.teams].sort((a, b) => b.totalPoints - a.totalPoints).map((team, index) => ({
      ...team, rank: index + 1, lastRank: null, total: team.totalPoints, eventPoints: team.gameweekPoints, squad: null
    }))
  };
}

export function weeklyAwards(weekly, gameweek) {
  const divisions = Object.keys(weekly[gameweek] ?? {}).sort();
  const teams = divisions.flatMap(key => weekly[gameweek][key].teams);
  function award(field) {
    const known = teams.filter(team => Number.isSafeInteger(team[field]));
    const value = known.length ? Math.max(...known.map(team => team[field])) : null;
    return { value, winners: known.filter(team => team[field] === value), knownTeams: known.length };
  }
  return { divisions, teams, mvp: award('gameweekPoints'), leader: award('totalPoints'), unlucky: award('benchPoints') };
}
