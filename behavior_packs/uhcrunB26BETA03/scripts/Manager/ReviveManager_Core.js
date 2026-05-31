import { GameMode, system, world } from '@minecraft/server';
import { dynamicToast } from '../plugin/Util.js';
import { notifyReviverCooldown } from './ReviveManager_Cooldown.js';
import { hasReviveItem, removeOneReviveItem, resolvePlayer, sendReviveTeamActionBar } from './ReviveManager_Util.js';
import { updateSidebar } from './ScoreboardManager.js';
import { uhcPlayerIds, uhcPlayersCache } from './State_Cache.js';
import { isGameRunning } from './State_Game.js';
import {
    REVIVE_ACTIONBAR_INTERVAL,
    REVIVE_CANCEL_MOVE_DISTANCE,
    REVIVE_COOLDOWN_TICKS,
    REVIVE_DURATION_TICKS,
    reviveIntervalId,
    reviveSessions,
    reviverCooldown,
    reviverSessions,
    setReviveIntervalId,
    stopReviveTickIfIdle,
} from './State_Revive.js';
import { aliveTeamDirtyHandler, deathLocation, playerStats, teamCounts, teamPlayerIndex } from './State_Team.js';
import { teleportLocPool } from './State_Util.js';
import { scheduleSaveStats } from './StatsManager.js';
import { getPlayerTeam } from './TeamActions.js';
import { REVIVE_MSG } from './UtilTeamManager.js';

export function cancelReviveSession(targetId, reason) {
    const session = reviveSessions.get(targetId);
    if (!session) return;

    reviveSessions.delete(targetId);
    reviverSessions.delete(session.reviverId);
    stopReviveTickIfIdle();

    if (!reason) return;

    const reviver = resolvePlayer(session.reviverId);
    if (reviver) {
        reviver.sendMessage(dynamicToast(reason, 'textures/ui/cancel'));
        reviver.playSound('note.bassattack');
    }

    const target = resolvePlayer(targetId);
    if (target) {
        target.onScreenDisplay.setActionBar(reason);
    }
}

export function finishRevive(targetId) {
    const session = reviveSessions.get(targetId);
    if (!session) return;

    const reviver = resolvePlayer(session.reviverId);
    const target = resolvePlayer(targetId);
    if (!reviver || !target) {
        cancelReviveSession(targetId, REVIVE_MSG.cancel);
        return;
    }

    if (!removeOneReviveItem(reviver)) {
        cancelReviveSession(targetId, REVIVE_MSG.needHead);
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

    const reviveMessage = REVIVE_MSG.revived(reviver.name, target.name);
    sendReviveTeamActionBar(teamId, reviveMessage);
    world.sendMessage(dynamicToast(reviveMessage, 'textures/ui/heart_new'));
    reviver.playSound('random.levelup');
    target.playSound('random.totem');
}

export function updateRevives() {
    if (reviveSessions.size === 0) {
        stopReviveTickIfIdle();
        return;
    }

    for (const [targetId, session] of reviveSessions) {
        const reviver = resolvePlayer(session.reviverId);
        const target = resolvePlayer(targetId);

        if (!reviver || !target) {
            cancelReviveSession(targetId, REVIVE_MSG.cancel);
            continue;
        }

        if (!reviver.hasTag('uhc')) {
            cancelReviveSession(targetId, REVIVE_MSG.reviverNotAlive);
            continue;
        }

        if (!hasReviveItem(reviver)) {
            cancelReviveSession(targetId, REVIVE_MSG.noReviveItem);
            continue;
        }

        if (!deathLocation.has(targetId)) {
            cancelReviveSession(targetId, REVIVE_MSG.targetNotDead);
            continue;
        }

        const reviverTeam = getPlayerTeam(reviver);
        if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) {
            cancelReviveSession(targetId, REVIVE_MSG.notSameTeam);
            continue;
        }

        const targetDeathLoc = deathLocation.get(targetId);
        if (!targetDeathLoc) {
            cancelReviveSession(targetId, REVIVE_MSG.noDeathLoc);
            continue;
        }

        if (reviver.dimension !== target.dimension) {
            cancelReviveSession(targetId, REVIVE_MSG.wrongDimension);
            continue;
        }

        const dx = reviver.location.x - session.anchorX;
        const dy = reviver.location.y - session.anchorY;
        const dz = reviver.location.z - session.anchorZ;

        if (dx * dx + dy * dy + dz * dz > REVIVE_CANCEL_MOVE_DISTANCE * REVIVE_CANCEL_MOVE_DISTANCE) {
            cancelReviveSession(targetId, REVIVE_MSG.movedTooFar);
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
        sendReviveTeamActionBar(session.teamId, REVIVE_MSG.progress(target.name, seconds));
    }
}

export function startReviveTick() {
    if (reviveIntervalId !== null) return;
    setReviveIntervalId(system.runInterval(updateRevives, 1));
}

export function startRevive(reviver, target) {
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

    const message = REVIVE_MSG.channeling(target.name);
    reviver.sendMessage(dynamicToast(message, 'textures/ui/heart_new'));
    sendReviveTeamActionBar(teamId, message);
}

export function validateReviveStart(reviver, target) {
    if (!reviver?.isValid || !target?.isValid) return false;

    if (!isGameRunning) return REVIVE_MSG.onlyDuringGame;
    if (!reviver.hasTag('uhc')) return REVIVE_MSG.onlyUhcAlive;
    if (!deathLocation.has(target.id)) return REVIVE_MSG.targetNotDeadYet;

    const reviverTeam = getPlayerTeam(reviver);
    if (!reviverTeam || reviverTeam !== getPlayerTeam(target)) return REVIVE_MSG.targetNotTeammate;

    if (reviveSessions.has(target.id)) return REVIVE_MSG.alreadyRevivingTarget;
    if (reviverSessions.has(reviver.id)) return REVIVE_MSG.alreadyRevivingOther;

    return null;
}

export function tryStartRevive(reviver, target) {
    const errorMessage = validateReviveStart(reviver, target);
    if (errorMessage === false) return;
    if (errorMessage) {
        reviver.sendMessage(dynamicToast(errorMessage, 'textures/ui/cancel'));
        return;
    }
    if (notifyReviverCooldown(reviver)) return;

    startRevive(reviver, target);
}

export function cancelReviveForPlayer(playerId) {
    if (!playerId) return;

    const targetId = reviverSessions.get(playerId);
    if (targetId) {
        cancelReviveSession(targetId, REVIVE_MSG.cancelEn);
    }

    if (reviveSessions.has(playerId)) {
        cancelReviveSession(playerId, REVIVE_MSG.cancelEn);
    }

    reviverCooldown.delete(playerId);
}
