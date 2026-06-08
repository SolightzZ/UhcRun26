import { lbCache, MAX_TEAMS } from './LeaderboardConfig.js';
import { buildTeamText } from './LeaderboardFormat.js';
import { playerCache } from './State_Cache.js';
import { playerStats, TEAM_LOOKUP, teamStats } from './State_Team.js';
import { getPlayersByTeam } from './TeamActions.js';
import { TEAMS } from './UtilTeamManager.js';

export function getStats() {
    const playerStatsMap = new Map();
    if (!playerStats?.size) return playerStatsMap;

    const entries = [...playerStats.entries()];
    for (let i = 0, len = entries.length; i < len; i++) {
        const [playerId, stats] = entries[i];
        const killCount = stats?.kills ?? 0;
        const deathCount = stats?.deaths ?? 0;
        if (!killCount && !deathCount) continue;

        const playerName = stats?.name ?? playerCache.get(playerId)?.name ?? playerId;
        const teamInfo = stats?.teamId ? TEAM_LOOKUP.get(stats.teamId) : null;
        const teamLabel = teamInfo ? teamInfo.color + teamInfo.name : null;

        playerStatsMap.set(playerName, {
            kills: killCount,
            deaths: deathCount,
            teamId: stats?.teamId ?? null,
            teamLabel,
        });
    }

    return playerStatsMap;
}

function getRuntimeTeamList() {
    const teamList = [];
    if (!TEAMS?.length) return teamList;

    for (let i = 0, len = TEAMS.length; i < len; i++) {
        const teamInfo = TEAMS[i];
        const stats = teamStats?.size ? teamStats.get(teamInfo.id) : null;
        const killCount = stats?.kills ?? 0;
        const memberCount = getPlayersByTeam(teamInfo.id).length;

        teamList.push({
            name: teamInfo.color + teamInfo.name,
            kills: killCount,
            members: memberCount,
            order: i,
        });
    }

    teamList.sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.order - b.order;
    });

    if (teamList.length > MAX_TEAMS) teamList.length = MAX_TEAMS;
    return teamList;
}

export function getTeamText() {
    const teamList = getRuntimeTeamList();

    let teamHash = '';
    for (let i = 0, len = teamList.length; i < len; i++) {
        const team = teamList[i];
        teamHash += `${team.name}${team.kills}${team.members}${team.order}`;
    }

    if (teamHash === lbCache.lastTeamHash && lbCache.cachedTeamText) {
        return lbCache.cachedTeamText;
    }

    lbCache.cachedTeamText = buildTeamText(teamList);
    lbCache.lastTeamHash = teamHash;
    return lbCache.cachedTeamText;
}
