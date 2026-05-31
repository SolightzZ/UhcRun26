import { playerCache, playerTeamCache } from './State_Cache.js';
import { REVIVE_ITEM_ID } from './State_Revive.js';
import { deathLocation, teamPlayerIndex } from './State_Team.js';
import { getPlayerTeam } from './TeamActions.js';

export function resolvePlayer(id) {
    const player = playerCache.get(id);
    return player?.isValid ? player : null;
}

export function getPlayerInventoryContainer(player) {
    if (!player?.isValid) return null;
    return player.getComponent('minecraft:inventory')?.container ?? null;
}

export function hasReviveItem(player) {
    const container = getPlayerInventoryContainer(player);
    if (!container) return false;

    const maxSlot = Math.min(9, container.size);
    for (let slot = 0; slot < maxSlot; slot++) {
        const item = container.getItem(slot);
        if (!item) continue;
        if (item.typeId !== REVIVE_ITEM_ID) continue;
        if ((item.amount ?? 0) <= 0) continue;
        return true;
    }

    return false;
}

export function removeOneReviveItem(player) {
    const container = getPlayerInventoryContainer(player);
    if (!container) return false;

    const maxSlot = Math.min(9, container.size);
    for (let slot = 0; slot < maxSlot; slot++) {
        const item = container.getItem(slot);
        if (!item) continue;
        if (item.typeId !== REVIVE_ITEM_ID) continue;

        const amount = item.amount ?? 0;
        if (amount <= 0) continue;

        if (amount === 1) {
            container.setItem(slot, undefined);
        } else {
            item.amount = amount - 1;
            container.setItem(slot, item);
        }
        return true;
    }

    return false;
}

export function sendReviveTeamActionBar(teamId, message) {
    if (!teamId || !message) return;

    const seen = new Set();
    const memberIds = teamPlayerIndex.get(teamId);
    if (memberIds) {
        for (const id of memberIds) {
            if (seen.has(id)) continue;
            seen.add(id);
            const player = resolvePlayer(id);
            if (!player) continue;
            player.onScreenDisplay.setActionBar(message);
        }
    }

    for (const [id] of deathLocation.entries()) {
        if (seen.has(id)) continue;
        if (playerTeamCache.get(id) !== teamId) continue;
        const player = resolvePlayer(id);
        if (!player) continue;
        seen.add(id);
        player.onScreenDisplay.setActionBar(message);
    }
}

export function getDeadPlayersInTeam(player) {
    const deadPlayers = [];
    if (!player?.isValid) return deadPlayers;

    const teamId = getPlayerTeam(player);
    if (!teamId) return deadPlayers;

    for (const [id] of deathLocation.entries()) {
        if (id === player.id) continue;
        if (playerTeamCache.get(id) !== teamId) continue;
        const target = resolvePlayer(id);
        if (!target) continue;
        deadPlayers.push(target);
    }

    deadPlayers.sort((a, b) => a.name.localeCompare(b.name));
    return deadPlayers;
}
