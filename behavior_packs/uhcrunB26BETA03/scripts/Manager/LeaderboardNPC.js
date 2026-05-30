import { system, world } from '@minecraft/server';
import { NPCS, NPC_QUERY_OPTIONS, UI, resetCache } from './LeaderboardConfig.js';
import { getStats, getTeamText } from './LeaderboardData.js';
import { getDeathsText, getPlayerText } from './LeaderboardFormat.js';
import { refreshPlayerCaches } from './TeamManager.js';

function collectNpcsByTag(allNpcs) {
    const teamNpcs = [];
    const playerNpcs = [];
    const deathNpcs = [];

    for (let i = 0; i < allNpcs.length && i < 3; i++) {
        const npcEntity = allNpcs[i];
        if (!npcEntity?.isValid) continue;
        if (i === 0) teamNpcs.push(npcEntity);
        else if (i === 1) playerNpcs.push(npcEntity);
        else if (i === 2) deathNpcs.push(npcEntity);
    }

    return { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs };
}

export function renderBoard() {
    refreshPlayerCaches();

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
    for (let i = 0; i < npcList.length; i++) {
        const npcEntity = npcList[i];
        if (!npcEntity?.isValid) continue;
        if (typeof npcEntity.nameTag !== 'string') continue;
        if (npcEntity.nameTag === displayText) continue;
        npcEntity.nameTag = displayText;
    }
}

function spawnLeaderboardNPCNow() {
    const overworldDimension = world.getDimension('overworld');

    const existingNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
    for (let i = 0; i < existingNpcs.length; i++) {
        existingNpcs[i].remove();
    }

    for (let i = 0; i < NPCS.length; i++) {
        const npcConfig = NPCS[i];
        try {
            const newNpcEntity = overworldDimension.spawnEntity('minecraft:npc', {
                x: npcConfig.x,
                y: npcConfig.y,
                z: npcConfig.z,
            });

            if (i === 0) newNpcEntity.nameTag = '§b§lTOP TEAMS (KILLS)';
            else if (i === 1) newNpcEntity.nameTag = '§e§lTOP PLAYERS (KILLS)';
            else if (i === 2) newNpcEntity.nameTag = '§c§lTOP PLAYERS (DEATHS)';
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
