import { MAX_PLAYERS, MAX_TEAMS, generateStatsHash, getRankColor, lbCache } from './LeaderboardConfig.js';

function buildEmptyPlayerText() {
    return `§eTop ${MAX_PLAYERS} Players (Kills)\n\n§7None (0)\n`;
}

function buildEmptyTeamText() {
    return `§bTop ${MAX_TEAMS} Teams (Kills)\n\n§7None (0)\n`;
}

function buildEmptyDeathsText() {
    return `§cTop ${MAX_PLAYERS} Deaths\n\n§7None (0)\n`;
}

export function buildTeamText(teamList) {
    if (!teamList.length) return buildEmptyTeamText();
    let text = `§bTop ${MAX_TEAMS} Teams (Kills)\n\n`;
    for (let i = 0, len = teamList.length; i < len; i++) {
        const team = teamList[i];
        const rankColor = getRankColor(i);
        const memberCount = team.members !== undefined ? team.members : 0;
        text += `${rankColor}#${i + 1} ${team.name} §f: §c${team.kills} Kills §7(${memberCount} Players)\n`;
    }
    return text;
}

export function getPlayerText(playerStatsMap) {
    const currentHash = generateStatsHash(playerStatsMap);
    if (currentHash === lbCache.lastStatsHash && lbCache.cachedPlayerText) {
        return lbCache.cachedPlayerText;
    }

    const playerList = [];
    const pEntries = [...playerStatsMap.entries()];
    for (let p = 0, pLen = pEntries.length; p < pLen; p++) {
        const [playerName, playerStats] = pEntries[p];
        if (!playerStats.kills && !playerStats.deaths) continue;
        playerList.push({ name: playerName, st: playerStats });
    }

    playerList.sort((a, b) => {
        if (b.st.kills !== a.st.kills) return b.st.kills - a.st.kills;
        return a.name.localeCompare(b.name);
    });

    if (playerList.length > MAX_PLAYERS) playerList.length = MAX_PLAYERS;

    if (!playerList.length) {
        lbCache.lastStatsHash = currentHash;
        lbCache.cachedPlayerText = buildEmptyPlayerText();
        return lbCache.cachedPlayerText;
    }

    let text = `§eTop ${MAX_PLAYERS} Players (Kills)\n\n`;
    for (let i = 0, len = playerList.length; i < len; i++) {
        const playerItem = playerList[i];
        const rankColor = getRankColor(i);
        const teamSuffix = playerItem.st.teamLabel ? ` §8[${playerItem.st.teamLabel}§8]` : '';
        text += `${rankColor}#${i + 1} §a${playerItem.name}${teamSuffix} §f- §c${playerItem.st.kills} Kills §8(§4${playerItem.st.deaths} Deaths§8)\n`;
    }

    lbCache.lastStatsHash = currentHash;
    lbCache.cachedPlayerText = text;
    return text;
}

export function getDeathsText(playerStatsMap) {
    const currentHash = generateStatsHash(playerStatsMap);
    if (currentHash === lbCache.lastDeathsHash && lbCache.cachedDeathsText) {
        return lbCache.cachedDeathsText;
    }

    const deathsList = [];
    const dEntries = [...playerStatsMap.entries()];
    for (let d = 0, dLen = dEntries.length; d < dLen; d++) {
        const [playerName, playerStats] = dEntries[d];
        if (!playerStats.deaths) continue;
        deathsList.push({ name: playerName, st: playerStats });
    }

    deathsList.sort((a, b) => {
        if (b.st.deaths !== a.st.deaths) return b.st.deaths - a.st.deaths;
        return a.name.localeCompare(b.name);
    });

    if (deathsList.length > MAX_PLAYERS) deathsList.length = MAX_PLAYERS;

    if (!deathsList.length) {
        lbCache.lastDeathsHash = currentHash;
        lbCache.cachedDeathsText = buildEmptyDeathsText();
        return lbCache.cachedDeathsText;
    }

    let text = `§cTop ${MAX_PLAYERS} Deaths\n\n`;
    for (let i = 0, len = deathsList.length; i < len; i++) {
        const playerItem = deathsList[i];
        const rankColor = getRankColor(i);
        const teamSuffix = playerItem.st.teamLabel ? ` §8[${playerItem.st.teamLabel}§8]` : '';
        text += `${rankColor}#${i + 1} §a${playerItem.name}${teamSuffix} §f- §4${playerItem.st.deaths} Deaths §8(§c${playerItem.st.kills} Kills§8)\n`;
    }

    lbCache.lastDeathsHash = currentHash;
    lbCache.cachedDeathsText = text;
    return text;
}
