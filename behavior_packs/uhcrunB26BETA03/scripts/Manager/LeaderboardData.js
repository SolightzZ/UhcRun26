import { lbCache, MAX_TEAMS } from './LeaderboardConfig.js';
import { buildTeamText } from './LeaderboardFormat.js';
import { getKdHistoryObjective, getPlayerName, getPlayersByTeam, getPlayerStats, getTeamInfo, getTeamKillObjective, getTeams, getTeamStats } from './TeamManager.js';

function processScoreEntry(scoreEntry, playerStatsMap) {
    const scoreValue = scoreEntry?.score ?? 0;
    if (scoreValue <= 0) return;

    const displayName = scoreEntry?.participant?.displayName;
    if (!displayName) return;

    const nameParts = displayName.split(' | Victim : ');
    if (nameParts.length !== 2) return;

    const killerName = nameParts[0].replace('Kill: ', '').trim();
    const victimName = nameParts[1].trim();
    if (!killerName || !victimName) return;

    if (!playerStatsMap.has(killerName)) {
        playerStatsMap.set(killerName, { kills: 0, deaths: 0, teamId: null, teamLabel: null });
    }
    playerStatsMap.get(killerName).kills += scoreValue;

    if (!playerStatsMap.has(victimName)) {
        playerStatsMap.set(victimName, { kills: 0, deaths: 0, teamId: null, teamLabel: null });
    }
    playerStatsMap.get(victimName).deaths += scoreValue;
}

function getObjectivePlayerStats() {
    const kdHistoryObjective = getKdHistoryObjective();
    const playerStatsMap = new Map();
    if (!kdHistoryObjective) return playerStatsMap;

    const objectiveScores = kdHistoryObjective.getScores();
    if (!objectiveScores?.length) return playerStatsMap;

    for (let i = 0; i < objectiveScores.length; i++) {
        processScoreEntry(objectiveScores[i], playerStatsMap);
    }

    return playerStatsMap;
}

export function getStats() {
    const objectivePlayerStats = getObjectivePlayerStats();
    if (objectivePlayerStats.size) return objectivePlayerStats;

    const rawPlayerStats = getPlayerStats();
    const playerStatsMap = new Map();
    if (!rawPlayerStats?.size) return playerStatsMap;

    const playerEntries = Array.from(rawPlayerStats.entries());
    for (let i = 0; i < playerEntries.length; i++) {
        const [playerId, playerStats] = playerEntries[i];
        const killCount = playerStats?.kills ?? 0;
        const deathCount = playerStats?.deaths ?? 0;
        if (!killCount && !deathCount) continue;

        const playerName = getPlayerName(playerId) ?? playerId;
        const teamInfo = playerStats?.teamId ? getTeamInfo(playerStats.teamId) : null;
        const teamLabel = teamInfo ? teamInfo.color + teamInfo.name : null;

        playerStatsMap.set(playerName, {
            kills: killCount,
            deaths: deathCount,
            teamId: playerStats?.teamId ?? null,
            teamLabel,
        });
    }

    return playerStatsMap;
}

function getObjectiveTeamList(teamKillObjective) {
    const objectiveScores = teamKillObjective.getScores();
    const allTeams = getTeams();
    const teamList = [];

    if (!objectiveScores?.length) return teamList;

    const teamMap = new Map();
    for (let i = 0; i < allTeams.length; i++) {
        const team = allTeams[i];
        teamMap.set(team.color + team.name, { team, index: i });
    }

    for (let i = 0; i < objectiveScores.length; i++) {
        const scoreEntry = objectiveScores[i];
        const teamDisplayName = scoreEntry?.participant?.displayName;
        if (!teamDisplayName) continue;

        const teamScoreValue = scoreEntry.score;
        if (teamScoreValue <= 0) continue;

        const teamData = teamMap.get(teamDisplayName);
        if (!teamData) continue;

        teamList.push({
            name: teamDisplayName,
            kills: teamScoreValue,
            members: getPlayersByTeam(teamData.team.id).length,
            order: teamData.index,
        });
    }

    teamList.sort((a, b) => {
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.order - b.order;
    });

    if (teamList.length > MAX_TEAMS) teamList.length = MAX_TEAMS;
    return teamList;
}

function getRuntimeTeamList() {
    const allTeams = getTeams();
    const teamStatsMap = getTeamStats();
    const teamList = [];
    if (!allTeams?.length) return teamList;

    for (let i = 0; i < allTeams.length; i++) {
        const teamInfo = allTeams[i];
        const teamStats = teamStatsMap?.size ? teamStatsMap.get(teamInfo.id) : null;
        const killCount = teamStats?.kills ?? 0;
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
    const teamKillObjective = getTeamKillObjective();
    let teamList = [];

    if (teamKillObjective) {
        const objectiveTeamList = getObjectiveTeamList(teamKillObjective);
        teamList = objectiveTeamList.length ? objectiveTeamList : getRuntimeTeamList();
    } else {
        teamList = getRuntimeTeamList();
    }

    let teamHash = '';
    for (let i = 0; i < teamList.length; i++) {
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
