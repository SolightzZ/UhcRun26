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

const avgX = NPCS.reduce((sum, npc) => sum + npc.x, 0) / NPCS.length;
const avgY = NPCS.reduce((sum, npc) => sum + npc.y, 0) / NPCS.length;
const avgZ = NPCS.reduce((sum, npc) => sum + npc.z, 0) / NPCS.length;

export const NPC_QUERY_OPTIONS = Object.freeze({
    type: 'minecraft:npc',
    location: { x: avgX, y: avgY, z: avgZ },
    maxDistance: 10,
});

export const lbCache = {
    lastStatsHash: '',
    lastDeathsHash: '',
    lastTeamHash: '',
    cachedPlayerText: '',
    cachedTeamText: '',
    cachedDeathsText: '',
};

export function resetCache() {
    lbCache.lastStatsHash = '';
    lbCache.lastDeathsHash = '';
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
    const entries = [...statsMap.entries()];
    for (let i = 0, len = entries.length; i < len; i++) {
        const [name, stats] = entries[i];
        hashString += `${name}${stats.kills}${stats.deaths}${stats.teamLabel || ''}`;
    }
    return hashString;
}
