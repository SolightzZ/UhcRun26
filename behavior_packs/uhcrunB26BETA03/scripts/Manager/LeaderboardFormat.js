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
    for (let i = 0; i < teamList.length; i++) {
        const rankColor = getRankColor(i);
        const memberCount = teamList[i].members !== undefined ? teamList[i].members : 0;
        text += `${rankColor}#${i + 1} ${teamList[i].name} §f: §c${teamList[i].kills} Kills §7(${memberCount} Players)\n`;
    }
    return text;
}

export function getPlayerText(playerStatsMap) {
    const currentHash = generateStatsHash(playerStatsMap);
    if (currentHash === lbCache.lastStatsHash && lbCache.cachedPlayerText) {
        return lbCache.cachedPlayerText;
    }

    const playerList = [];
    const statsEntries = Array.from(playerStatsMap.entries());
    for (let i = 0; i < statsEntries.length; i++) {
        const [playerName, playerStats] = statsEntries[i];
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
    for (let i = 0; i < playerList.length; i++) {
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
    if (currentHash === lbCache.lastStatsHash && lbCache.cachedDeathsText) {
        return lbCache.cachedDeathsText;
    }

    const deathsList = [];
    const statsEntries = Array.from(playerStatsMap.entries());
    for (let i = 0; i < statsEntries.length; i++) {
        const [playerName, playerStats] = statsEntries[i];
        if (!playerStats.deaths) continue;
        deathsList.push({ name: playerName, st: playerStats });
    }

    deathsList.sort((a, b) => {
        if (b.st.deaths !== a.st.deaths) return b.st.deaths - a.st.deaths;
        return a.name.localeCompare(b.name);
    });

    if (deathsList.length > MAX_PLAYERS) deathsList.length = MAX_PLAYERS;

    if (!deathsList.length) {
        lbCache.cachedDeathsText = buildEmptyDeathsText();
        return lbCache.cachedDeathsText;
    }

    let text = `§cTop ${MAX_PLAYERS} Deaths\n\n`;
    for (let i = 0; i < deathsList.length; i++) {
        const playerItem = deathsList[i];
        const rankColor = getRankColor(i);
        const teamSuffix = playerItem.st.teamLabel ? ` §8[${playerItem.st.teamLabel}§8]` : '';
        text += `${rankColor}#${i + 1} §a${playerItem.name}${teamSuffix} §f- §4${playerItem.st.deaths} Deaths §8(§c${playerItem.st.kills} Kills§8)\n`;
    }

    lbCache.cachedDeathsText = text;
    return text;
}
