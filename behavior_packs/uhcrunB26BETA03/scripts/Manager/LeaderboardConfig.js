export const MAX_PLAYERS = 10;
export const MAX_TEAMS = 10;

export const UI = Object.freeze({
    HEAD: '§g§l--- [ UHCRUN LEADERBOARD ] ---\n\n',
    FOOT: '\n§g-----------------------------------',
    RANKS: ['§6', '§7', '§c', '§f'],
});

export const NPCS = Object.freeze([
    { x: 596.5, y: 127, z: 601.5 },
    { x: 593.5, y: 127, z: 600.5 },
    { x: 599.5, y: 127, z: 600.5 },
]);

export const NPC_QUERY_OPTIONS = Object.freeze({
    type: 'minecraft:npc',
    location: { x: 596, y: 127, z: 600 },
    maxDistance: 10,
});

export const lbCache = {
    lastStatsHash: '',
    lastTeamHash: '',
    cachedPlayerText: '',
    cachedTeamText: '',
    cachedDeathsText: '',
};

export function resetCache() {
    lbCache.lastStatsHash = '';
    lbCache.lastTeamHash = '';
    lbCache.cachedPlayerText = '';
    lbCache.cachedTeamText = '';
    lbCache.cachedDeathsText = '';
}

export function getRankColor(index) {
    return index < UI.RANKS.length ? UI.RANKS[index] : UI.RANKS[3];
}

export function generateStatsHash(statsMap) {
    let hashString = '';
    for (const [name, stats] of statsMap) {
        hashString += `${name}${stats.kills}${stats.deaths}${stats.teamLabel || ''}`;
    }
    return hashString;
}
