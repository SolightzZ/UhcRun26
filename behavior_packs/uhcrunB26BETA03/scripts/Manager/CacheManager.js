import { world } from '@minecraft/server';
import { updateSidebar } from './ScoreboardManager.js';
import { CONFIG, TEAMS } from './UtilTeamManager.js';
import { allPlayersCache, allPlayersCacheIds, GlobalPlayerCaches, hitRegistry, killStreak, multiKill, playerCache, playerTeamCache, uhcPlayerIds, uhcPlayersCache } from './State_Cache.js';
import { TEAM_LOOKUP, aliveTeamDirtyHandler, deathLocation, playerStats, teamCounts, teamPlayerIndex, teamStats } from './State_Team.js';
import { isGameRunning } from './State_Game.js';
import { itemVacuumQueue } from './State_Queue.js';

export function removeCachedPlayerById(list, id) {
    if (!list || list.length === 0) return;
    const index = list.findIndex((p) => p?.id === id);
    if (index === -1) return;
    const lastIndex = list.length - 1;
    if (index !== lastIndex) {
        list[index] = list[lastIndex];
    }
    list.pop();
}

export function clearTeamRuntimeState() {
    for (const team of TEAMS) {
        teamCounts.set(team.id, 0);
        teamPlayerIndex.set(team.id, new Set());
    }
}

export function rebuildTeamRuntimeState(players) {
    playerTeamCache.clear();
    clearTeamRuntimeState();

    for (const p of players) {
        if (!p) continue;
        if (!p.isValid) continue;

        const teamId = p.getDynamicProperty(CONFIG.key);
        if (typeof teamId !== 'string') continue;
        if (!TEAM_LOOKUP.has(teamId)) continue;

        playerTeamCache.set(p.id, teamId);

        if (isGameRunning && !p?.hasTag('uhc')) continue;

        let count = teamCounts.get(teamId);
        if (!Number.isFinite(count)) {
            count = 0;
        }
        count = count + 1;
        teamCounts.set(teamId, count);

        const set = teamPlayerIndex.get(teamId);
        if (set) {
            set.add(p.id);
        }
    }
}

export function refreshPlayerCaches() {
    const players = world.getPlayers();

    allPlayersCache.length = 0;
    uhcPlayersCache.length = 0;
    allPlayersCacheIds.clear();
    uhcPlayerIds.clear();
    playerCache.clear();

    for (const p of players) {
        if (!p?.isValid) continue;

        allPlayersCache.push(p);
        allPlayersCacheIds.add(p.id);
        playerCache.set(p.id, p);

        if (p.hasTag('uhc')) {
            uhcPlayersCache.push(p);
            uhcPlayerIds.add(p.id);
        }
    }

    rebuildTeamRuntimeState(players);
}

export function removePlayerFromRuntimeState(id, teamId, fullCleanup) {
    if (teamId === undefined) {
        teamId = playerTeamCache.get(id);
    }

    if (fullCleanup === undefined) {
        fullCleanup = false;
    }

    if (teamId && TEAM_LOOKUP.has(teamId)) {
        const set = teamPlayerIndex.get(teamId);
        if (set) {
            set.delete(id);
        }

        let count = teamCounts.get(teamId);
        if (!Number.isFinite(count)) {
            count = 0;
        }

        count = count - 1;
        if (count < 0) {
            count = 0;
        }
        teamCounts.set(teamId, count);
    }

    playerTeamCache.delete(id);

    if (!fullCleanup) return;

    playerCache.delete(id);
    hitRegistry.delete(id);
    deathLocation.delete(id);
    multiKill.delete(id);
    killStreak.delete(id);
    uhcPlayerIds.delete(id);
}

export function removePlayerFromAliveRuntimeState(id, teamId) {
    if (!id) return;

    const resolvedTeamId = teamId ?? playerTeamCache.get(id) ?? null;
    uhcPlayerIds.delete(id);

    removeCachedPlayerById(uhcPlayersCache, id);

    if (!resolvedTeamId || !TEAM_LOOKUP.has(resolvedTeamId)) {
        aliveTeamDirtyHandler();
        return;
    }

    const count = teamCounts.get(resolvedTeamId) ?? 0;
    teamCounts.set(resolvedTeamId, count > 0 ? count - 1 : 0);
    teamPlayerIndex.get(resolvedTeamId)?.delete(id);
    updateSidebar(resolvedTeamId);
    aliveTeamDirtyHandler();
}

export function checkAllCaches() {
    const cacheInfo = {
        teamCounts: teamCounts.size,
        playerTeamCache: playerTeamCache.size,
        teamPlayerIndex: teamPlayerIndex.size,
        playerCache: playerCache.size,
        uhcPlayerIds: uhcPlayerIds.size,
        allPlayersCache: allPlayersCache.length,
        allPlayersCacheIds: allPlayersCacheIds.size,
        uhcPlayersCache: uhcPlayersCache.length,
        teamStats: teamStats.size,
        playerStats: playerStats.size,
        deathLocation: deathLocation.size,
        multiKill: multiKill.size,
        killStreak: killStreak.size,
        hitRegistry: hitRegistry.size,
    };

    let message = '§e=== Cache Status ===§r\n';
    message += `§7teamCounts: §f${cacheInfo.teamCounts}\n`;
    message += `§7playerTeamCache: §f${cacheInfo.playerTeamCache}\n`;
    message += `§7teamPlayerIndex: §f${cacheInfo.teamPlayerIndex}\n`;
    message += `§7playerCache: §f${cacheInfo.playerCache}\n`;
    message += `§7uhcPlayerIds: §f${cacheInfo.uhcPlayerIds}\n`;
    message += `§7allPlayersCache: §f${cacheInfo.allPlayersCache}\n`;
    message += `§7allPlayersCacheIds: §f${cacheInfo.allPlayersCacheIds}\n`;
    message += `§7uhcPlayersCache: §f${cacheInfo.uhcPlayersCache}\n`;
    message += `§7teamStats: §f${cacheInfo.teamStats}\n`;
    message += `§7playerStats: §f${cacheInfo.playerStats}\n`;
    message += `§7deathLocation: §f${cacheInfo.deathLocation}\n`;
    message += `§7multiKill: §f${cacheInfo.multiKill}\n`;
    message += `§7killStreak: §f${cacheInfo.killStreak}\n`;
    message += `§7hitRegistry: §f${cacheInfo.hitRegistry}\n`;

    const totalSize = Object.values(cacheInfo).reduce((sum, val) => sum + val, 0);
    message += `§e=== Total: §c${totalSize} §eentries ===`;

    return { info: cacheInfo, message, totalSize };
}

function clearRuntimeCaches({ includeStats = false } = {}) {
    const before = checkAllCaches();

    playerTeamCache.clear();
    playerCache.clear();
    uhcPlayerIds.clear();
    allPlayersCache.length = 0;
    uhcPlayersCache.length = 0;
    allPlayersCacheIds.clear();
    clearTeamRuntimeState();
    deathLocation.clear();
    multiKill.clear();
    killStreak.clear();
    hitRegistry.clear();

    if (includeStats) {
        for (const team of TEAMS) {
            teamStats.set(team.id, { kills: 0, deaths: 0 });
        }
        playerStats.clear();
        world.setDynamicProperty('uhc_teamStats', undefined);
        world.setDynamicProperty('uhc_playerStats', undefined);
    }

    const after = checkAllCaches();
    const cleared = before.totalSize - after.totalSize;
    const statsNote = includeStats ? ' (including stats)' : '';

    return {
        before: before.totalSize,
        after: after.totalSize,
        cleared,
        message: `${includeStats ? '§a' : ''}[Cache] Cleared ${cleared} entries${statsNote}\n§7Before: ${before.totalSize} → After: ${after.totalSize}`,
    };
}

export function clearAllCaches() {
    return clearRuntimeCaches({ includeStats: false });
}

export function clearAllCachesIncludingStats() {
    return clearRuntimeCaches({ includeStats: true });
}

export function purgePlayerCacheOnLeave(id) {
    if (!id) return;

    const teamId = playerTeamCache.get(id);
    const isCounted = !isGameRunning || uhcPlayerIds.has(id);
    const countedTeamId = isCounted ? teamId : null;

    removePlayerFromRuntimeState(id, countedTeamId, true);

    removeCachedPlayerById(allPlayersCache, id);
    allPlayersCacheIds.delete(id);
    removeCachedPlayerById(uhcPlayersCache, id);

    if (itemVacuumQueue.length > 0) {
        deathLocation.delete(id);
    }

    aliveTeamDirtyHandler();
    GlobalPlayerCaches.delete(id);
}
