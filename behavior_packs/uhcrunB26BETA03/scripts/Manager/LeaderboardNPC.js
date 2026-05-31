import { system, world } from '@minecraft/server';
import { refreshPlayerCaches } from './CacheManager.js';
import { NPCS, NPC_QUERY_OPTIONS, UI, resetCache } from './LeaderboardConfig.js';
import { getStats, getTeamText } from './LeaderboardData.js';
import { getDeathsText, getPlayerText } from './LeaderboardFormat.js';

function collectNpcsByTag(allNpcs) {
    const teamNpcs = [];
    const playerNpcs = [];
    const deathNpcs = [];

    for (const npcEntity of allNpcs) {
        if (!npcEntity?.isValid) continue;
        if (npcEntity.hasTag('lb:teams')) teamNpcs.push(npcEntity);
        else if (npcEntity.hasTag('lb:players')) playerNpcs.push(npcEntity);
        else if (npcEntity.hasTag('lb:deaths')) deathNpcs.push(npcEntity);
    }

    return { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs };
}

export function renderBoard() {
    const overworldDimension = world.getDimension('overworld');
    let allNpcs = [];

    try {
        allNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
    } catch (error) {
        console.warn('[DEBUG] Error getting NPCs:', error);
        return;
    }

    if (!allNpcs.length) return;

    const { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs } = collectNpcsByTag(allNpcs);

    if (!teamNpcs.length && !playerNpcs.length && !deathNpcs.length) return;

    const playerStats = getStats();

    if (teamNpcs.length) {
        const teamText = getTeamText();
        updateNpcText(teamNpcs, `${UI.HEAD}${teamText}${UI.FOOT}`);
    }

    if (playerNpcs.length) {
        const playerText = getPlayerText(playerStats);
        updateNpcText(playerNpcs, `${UI.HEAD}${playerText}${UI.FOOT}`);
    }

    if (deathNpcs.length) {
        const deathsText = getDeathsText(playerStats);
        updateNpcText(deathNpcs, `${UI.HEAD}${deathsText}${UI.FOOT}`);
    }
}

function updateNpcText(npcList, displayText) {
    for (const npcEntity of npcList) {
        if (!npcEntity?.isValid) continue;
        if (typeof npcEntity.nameTag !== 'string') continue;
        if (npcEntity.nameTag === displayText) continue;
        npcEntity.nameTag = displayText;
    }
}

function spawnLeaderboardNPCNow() {
    const overworldDimension = world.getDimension('overworld');

    const existingNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
    for (const npc of existingNpcs) {
        npc.remove();
    }

    for (const [i, npcConfig] of NPCS.entries()) {
        try {
            const newNpcEntity = overworldDimension.spawnEntity('minecraft:npc', {
                x: npcConfig.x,
                y: npcConfig.y,
                z: npcConfig.z,
            });

            if (i === 0) {
                newNpcEntity.nameTag = '§b§lTOP TEAMS (KILLS)';
                newNpcEntity.addTag('lb:teams');
            } else if (i === 1) {
                newNpcEntity.nameTag = '§e§lTOP PLAYERS (KILLS)';
                newNpcEntity.addTag('lb:players');
            } else if (i === 2) {
                newNpcEntity.nameTag = '§c§lTOP PLAYERS (DEATHS)';
                newNpcEntity.addTag('lb:deaths');
            }
        } catch (error) {
            console.warn('[Leaderboard] Failed to spawn NPC at:', npcConfig.x, npcConfig.y, npcConfig.z, error);
        }
    }

    updateLeaderboard();
}

export function updateLeaderboard() {
    system.runTimeout(() => {
        resetCache();
        refreshPlayerCaches();
        renderBoard();
    }, 40);
}

export function spawnLeaderboardNPC() {
    system.runTimeout(spawnLeaderboardNPCNow, 20);
}

system.run(renderBoard);

export function HandlerCancelNPC(eventData) {
    const { target } = eventData;
    if (target.typeId === 'minecraft:npc') {
        eventData.cancel = true;
    }
}
