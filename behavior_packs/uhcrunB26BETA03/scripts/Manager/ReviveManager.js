import { GameMode, system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { dynamicToast } from '../plugin/Util.js';
import { updateSidebar } from './ScoreboardManager.js';
import {
    CONFIG,
    REVIVE_ACTIONBAR_INTERVAL,
    REVIVE_CANCEL_MOVE_DISTANCE,
    REVIVE_COOLDOWN_TICKS,
    REVIVE_DURATION_TICKS,
    REVIVE_ITEM_ID,
    aliveTeamDirtyHandler,
    deathLocation,
    isGameRunning,
    playerCache,
    playerStats,
    reviveIntervalId,
    reviveSessions,
    reviverCooldown,
    reviverSessions,
    setReviveIntervalId,
    stopReviveTickIfIdle,
    teamCounts,
    teamPlayerIndex,
    teleportLocPool,
    uhcPlayerIds,
    uhcPlayersCache,
} from './State.js';
import { scheduleSaveStats } from './StatsManager.js';
import { getCachedPlayers, getPlayerTeam } from './TeamActions.js';

function getPlayerById(id) {
    if (!id) return null;
    const cached = playerCache.get(id);
    if (cached?.isValid) return cached;

    const players = world.getPlayers();
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player?.isValid) continue;
        playerCache.set(player.id, player);
        if (player.id === id) return player;
    }

    return null;
}

function isPlayerDead(id) {
    return !!id && deathLocation.has(id);
}

function getRemainingReviveCooldown(playerId) {
    if (!playerId) return 0;
    const endTick = reviverCooldown.get(playerId) ?? 0;
    const remaining = endTick - system.currentTick;
    return remaining > 0 ? remaining : 0;
}

function clearExpiredReviveCooldown(playerId) {
    if (!playerId) return;
    if (getRemainingReviveCooldown(playerId) > 0) return;
    reviverCooldown.delete(playerId);
}

function getDeadPlayersInTeam(player) {
    const deadPlayers = [];
    if (!player?.isValid) return deadPlayers;

    const teamId = getPlayerTeam(player);
    if (!teamId) return deadPlayers;

    const players = getCachedPlayers();
    for (let i = 0; i < players.length; i++) {
        const target = players[i];
        if (!target?.isValid) continue;
        if (target.id === player.id) continue;
        if (!isPlayerDead(target.id)) continue;
        if (getPlayerTeam(target) !== teamId) continue;
        deadPlayers.push(target);
    }

    deadPlayers.sort((a, b) => a.name.localeCompare(b.name));
    return deadPlayers;
}

function getDeathLocation(id) {
    return id ? (deathLocation.get(id) ?? null) : null;
}

function getPlayerInventoryContainer(player) {
    if (!player?.isValid) return null;
    return player.getComponent('minecraft:inventory')?.container ?? null;
}

function hasReviveItem(player) {
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

function removeOneReviveItem(player) {
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

function isSameTeam(playerA, playerB) {
    if (!playerA?.isValid || !playerB?.isValid) return false;
    const teamA = getPlayerTeam(playerA);
    const teamB = getPlayerTeam(playerB);
    return !!teamA && teamA === teamB;
}

function sendReviveTeamActionBar(teamId, message) {
    if (!teamId || !message) return;
    const players = getCachedPlayers();
    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player?.isValid) continue;
        if (getPlayerTeam(player) !== teamId) continue;
        player.onScreenDisplay.setActionBar(message);
    }
}

function cancelReviveSession(targetId, reason) {
    const session = reviveSessions.get(targetId);
    if (!session) return;

    reviveSessions.delete(targetId);
    reviverSessions.delete(session.reviverId);
    stopReviveTickIfIdle();

    if (!reason) return;

    const reviver = getPlayerById(session.reviverId);
    if (reviver?.isValid) {
        reviver.sendMessage(dynamicToast(reason, 'textures/ui/cancel'));
        reviver.playSound('note.bassattack');
    }

    const target = getPlayerById(targetId);
    if (target?.isValid) {
        target.onScreenDisplay.setActionBar(reason);
    }
}

function finishRevive(targetId) {
    const session = reviveSessions.get(targetId);
    if (!session) return;

    const reviver = getPlayerById(session.reviverId);
    const target = getPlayerById(targetId);
    if (!reviver?.isValid || !target?.isValid) {
        cancelReviveSession(targetId, '§cยกเลิกการชุบ');
        return;
    }

    if (!removeOneReviveItem(reviver)) {
        cancelReviveSession(targetId, '§cต้องใช้หัวผู้เล่น 1 ไอเทมในการชุบ');
        return;
    }

    const teamId = getPlayerTeam(reviver);
    reviveSessions.delete(targetId);
    reviverSessions.delete(session.reviverId);
    reviverCooldown.set(session.reviverId, system.currentTick + REVIVE_COOLDOWN_TICKS);
    stopReviveTickIfIdle();

    deathLocation.delete(targetId);

    teleportLocPool.x = reviver.location.x;
    teleportLocPool.y = reviver.location.y;
    teleportLocPool.z = reviver.location.z;
    target.teleport(teleportLocPool, { dimension: reviver.dimension });
    target.setGameMode(GameMode.Survival);
    target.addTag('uhc');
    target.removeEffect('conduit_power');
    target.addEffect('regeneration', 200, { amplifier: 2, showParticles: false });
    target.addEffect('resistance', 100, { amplifier: 4, showParticles: false });

    if (!uhcPlayerIds.has(targetId)) {
        uhcPlayerIds.add(targetId);
        uhcPlayersCache.push(target);
    }

    if (teamId) {
        const before = teamCounts.get(teamId) ?? 0;
        teamCounts.set(teamId, before + 1);
        teamPlayerIndex.get(teamId)?.add(targetId);
        updateSidebar(teamId);
    }

    const stats = playerStats.get(targetId);
    if (stats) {
        stats.teamId = teamId;
        stats.name = target.name;
        playerStats.set(targetId, stats);
    }

    aliveTeamDirtyHandler();
    scheduleSaveStats();

    const reviveMessage = `§a${reviver.name} revived ${target.name}`;
    sendReviveTeamActionBar(teamId, reviveMessage);
    world.sendMessage(dynamicToast(reviveMessage, 'textures/ui/heart_new'));
    reviver.playSound('random.levelup');
    target.playSound('random.totem');
}

function updateRevives() {
    if (reviveSessions.size === 0) {
        stopReviveTickIfIdle();
        return;
    }

    for (const [targetId, session] of reviveSessions) {
        const reviver = getPlayerById(session.reviverId);
        const target = getPlayerById(targetId);

        if (!reviver?.isValid || !target?.isValid) {
            cancelReviveSession(targetId, '§cยกเลิกการชุบ');
            continue;
        }

        if (!reviver.hasTag('uhc')) {
            cancelReviveSession(targetId, '§cผู้ชุบไม่ใช่ผู้เล่นที่ยังมีชีวิตแล้ว');
            continue;
        }

        if (!hasReviveItem(reviver)) {
            cancelReviveSession(targetId, '§cไม่มีไอเท็มสำหรับชุบ');
            continue;
        }

        if (!isPlayerDead(targetId)) {
            cancelReviveSession(targetId, '§cเป้าหมายไม่ได้อยู่ในสถานะตาย');
            continue;
        }

        if (!isSameTeam(reviver, target)) {
            cancelReviveSession(targetId, '§cไม่ได้อยู่ทีมเดียวกัน');
            continue;
        }

        const targetDeathLoc = getDeathLocation(targetId);
        if (!targetDeathLoc) {
            cancelReviveSession(targetId, '§cไม่พบตำแหน่งที่ตาย');
            continue;
        }

        if (reviver.dimension !== target.dimension) {
            cancelReviveSession(targetId, '§cอยู่คนละมิติ');
            continue;
        }

        const dx = reviver.location.x - session.anchorX;
        const dy = reviver.location.y - session.anchorY;
        const dz = reviver.location.z - session.anchorZ;

        if (dx * dx + dy * dy + dz * dz > REVIVE_CANCEL_MOVE_DISTANCE * REVIVE_CANCEL_MOVE_DISTANCE) {
            cancelReviveSession(targetId, '§cระยะห่างเกินกำหนด');
            continue;
        }

        const remainingTicks = session.endTick - system.currentTick;
        if (remainingTicks <= 0) {
            finishRevive(targetId);
            continue;
        }

        if (session.lastUiTick !== undefined && system.currentTick - session.lastUiTick < REVIVE_ACTIONBAR_INTERVAL) {
            continue;
        }

        session.lastUiTick = system.currentTick;
        const seconds = Math.ceil(remainingTicks / 20);

        sendReviveTeamActionBar(session.teamId, `Reviving ${target.name} in ${seconds}s`);
    }
}

function startReviveTick() {
    if (reviveIntervalId !== null) return;
    setReviveIntervalId(system.runInterval(updateRevives, 1));
}

function startRevive(reviver, target) {
    if (!reviver?.isValid || !target?.isValid) return;

    const teamId = getPlayerTeam(reviver);
    if (!teamId) return;

    reviveSessions.set(target.id, {
        reviverId: reviver.id,
        endTick: system.currentTick + REVIVE_DURATION_TICKS,
        teamId,
        lastUiTick: -REVIVE_ACTIONBAR_INTERVAL,
        anchorX: reviver.location.x,
        anchorY: reviver.location.y,
        anchorZ: reviver.location.z,
    });
    reviverSessions.set(reviver.id, target.id);
    startReviveTick();

    const message = `§eกำลังชุบ ${target.name}`;
    reviver.sendMessage(dynamicToast(message, 'textures/ui/heart_new'));
    sendReviveTeamActionBar(teamId, message);
}

function tryStartRevive(reviver, target) {
    if (!reviver?.isValid || !target?.isValid) return;

    if (!isGameRunning) {
        reviver.sendMessage(dynamicToast('§cสามารถชุบชีวิตได้เฉพาะระหว่างเกมเท่านั้น', 'textures/ui/cancel'));
        return;
    }

    if (!reviver.hasTag('uhc')) {
        reviver.sendMessage(dynamicToast('§cเฉพาะผู้เล่น UHC ที่ยังมีชีวิตเท่านั้นที่ชุบได้', 'textures/ui/cancel'));
        return;
    }

    if (!isPlayerDead(target.id)) {
        reviver.sendMessage(dynamicToast('§cเป้าหมายยังไม่ตาย', 'textures/ui/cancel'));
        return;
    }

    if (!isSameTeam(reviver, target)) {
        reviver.sendMessage(dynamicToast('§cเป้าหมายไม่ใช่เพื่อนร่วมทีมของคุณ', 'textures/ui/cancel'));
        return;
    }

    if (reviveSessions.has(target.id)) {
        reviver.sendMessage(dynamicToast('§cมีคนกำลังชุบเป้าหมายนี้อยู่แล้ว', 'textures/ui/cancel'));
        return;
    }

    if (reviverSessions.has(reviver.id)) {
        reviver.sendMessage(dynamicToast('§cคุณกำลังชุบคนอื่นอยู่', 'textures/ui/cancel'));
        return;
    }

    clearExpiredReviveCooldown(reviver.id);
    const remainingCooldown = getRemainingReviveCooldown(reviver.id);

    if (remainingCooldown > 0) {
        const seconds = Math.ceil(remainingCooldown / 20);
        reviver.sendMessage(dynamicToast(`§cคูลดาวน์การชุบ: ${seconds} วินาที`, 'textures/ui/cancel'));
        return;
    }

    startRevive(reviver, target);
}

function openReviveUI(player, deadList) {
    if (!player?.isValid) return;
    const form = new ActionFormData();
    form.title(CONFIG.title);
    form.body('Revive Player');
    form.body('Select dead teammate');

    for (let i = 0; i < deadList.length; i++) {
        form.button(deadList[i].name, 'textures/ui/heart_new');
    }

    form.button('Back', 'textures/ui/cancel');
    form.show(player).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === deadList.length) return;
        const target = deadList[res.selection];
        if (!target?.isValid) return;
        tryStartRevive(player, target);
    });
}

export function onUseReviveItem(player) {
    if (!player?.isValid) return;
    if (!isGameRunning) return;
    if (!player.hasTag('uhc')) return;
    if (!hasReviveItem(player)) return;

    clearExpiredReviveCooldown(player.id);
    const remainingCooldown = getRemainingReviveCooldown(player.id);

    if (remainingCooldown > 0) {
        const seconds = Math.ceil(remainingCooldown / 20);
        player.sendMessage(dynamicToast(`§cคูลดาวน์การชุบ: ${seconds} วินาที`, 'textures/ui/cancel'));
        player.playSound('note.bassattack');
        return;
    }

    const deadList = getDeadPlayersInTeam(player);

    if (deadList.length === 0) {
        player.playSound('note.bassattack');
        return;
    }

    openReviveUI(player, deadList);
}

export function cancelReviveForPlayer(playerId) {
    if (!playerId) return;

    const targetId = reviverSessions.get(playerId);
    if (targetId) {
        cancelReviveSession(targetId, '§cRevive cancelled');
    }

    if (reviveSessions.has(playerId)) {
        cancelReviveSession(playerId, '§cRevive cancelled');
    }

    reviverCooldown.delete(playerId);
}
