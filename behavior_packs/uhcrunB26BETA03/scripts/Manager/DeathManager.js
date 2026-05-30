import { GameMode, ItemStack, system } from '@minecraft/server';
import { removePlayerFromAliveRuntimeState } from './CacheManager.js';
import { enqueueItemVacuum } from './ItemVacuum.js';
import { cancelReviveForPlayer } from './ReviveManager.js';
import {
    deathBatchRunning,
    deathLocation,
    deathQueue,
    entityQueryOptions,
    hitRegistry,
    isUHC,
    killStreak,
    multiKill,
    particleLocPool,
    playerStats,
    playerTeamCache,
    setDeathBatchRunning,
    spawnEntityLocPool,
    TEAM_LOOKUP,
    teamKillObj,
    teamStats,
} from './State.js';

import {
    getDeathDisplayInfo,
    handleFirstBlood,
    handleKillStreak,
    handleMultiKill,
    incrementPairHistory,
    resolveDeathCause,
    resolveKiller,
    scheduleSaveStats,
    sendDeathMessage,
    showDeathUI,
    trackHit,
} from './StatsManager.js';

function processDeathBatch() {
    let count = 0;
    let dynamicBatch = 5;

    if (deathQueue.length > 20) {
        dynamicBatch = 10;
    }

    while (count < dynamicBatch) {
        const entry = deathQueue.shift();
        if (!entry) break;
        const player = entry.player;
        if (!player?.isValid) continue;
        const deathInfo = getDeathDisplayInfo(player);
        showDeathUI(player, deathInfo);
        sendDeathMessage(player, deathInfo);
        count++;
    }

    if (deathQueue.length === 0) {
        setDeathBatchRunning(false);
        return;
    }

    system.run(processDeathBatch);
}

export function showDeathScreenshot(player) {
    if (!player?.isValid) return;

    deathQueue.push({ player });

    if (deathBatchRunning) return;

    setDeathBatchRunning(true);
    system.run(processDeathBatch);
}

function processVictimDeath(player, victimTeamId, loc) {
    const id = player.id;

    removePlayerFromAliveRuntimeState(id, victimTeamId);

    if (!loc) return;

    const dim = player.dimension;
    if (!dim) return;

    deathLocation.set(id, { x: loc.x, y: loc.y, z: loc.z });

    particleLocPool.x = loc.x;
    particleLocPool.y = loc.y + 4.5;
    particleLocPool.z = loc.z;
    dim.spawnParticle('so:light2', particleLocPool);

    particleLocPool.y = loc.y + 6.5;
    dim.spawnParticle('so:light5', particleLocPool);

    const snapX = loc.x;
    const snapY = loc.y;
    const snapZ = loc.z;

    system.runTimeout(() => {
        if (!player || !player.isValid) return;

        player.removeTag('uhc');
        player.setGameMode(GameMode.Spectator);

        enqueueItemVacuum(() => {
            spawnEntityLocPool.x = snapX;
            spawnEntityLocPool.y = snapY + 1.5;
            spawnEntityLocPool.z = snapZ;
            dim.spawnItem(new ItemStack('minecraft:player_head', 1), spawnEntityLocPool);
            const cart = dim.spawnEntity('minecraft:hopper_minecart', spawnEntityLocPool);
            if (!cart) return;

            const cartLoc = cart.location;

            entityQueryOptions.location.x = snapX;
            entityQueryOptions.location.y = snapY;
            entityQueryOptions.location.z = snapZ;

            const items = dim.getEntities(entityQueryOptions);
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item || !item.isValid) continue;
                item.teleport(cartLoc, { dimension: dim });
            }
        });
    }, 1);

    const victimPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
    victimPs.deaths++;
    victimPs.name = player.name;

    if (victimTeamId) {
        victimPs.teamId = victimTeamId;
    }

    playerStats.set(id, victimPs);

    const teamEntry = teamStats.get(victimTeamId);
    if (teamEntry) {
        teamEntry.deaths++;
    }

    scheduleSaveStats();
}

function processKillerRewards(killer, victimPlayer, victimTeamId) {
    const killerId = killer.id;
    const killerTeamId = playerTeamCache.get(killerId);

    if (killerTeamId && killerTeamId === victimTeamId) {
        hitRegistry.delete(victimPlayer.id);
        return;
    }

    incrementPairHistory(killer, victimPlayer);

    const killerPs = playerStats.get(killerId) ?? { kills: 0, deaths: 0 };
    killerPs.kills++;
    killerPs.name = killer.name;

    if (killerTeamId) {
        killerPs.teamId = killerTeamId;
    }

    playerStats.set(killerId, killerPs);

    const teamEntry = teamStats.get(killerTeamId);

    if (teamEntry) {
        teamEntry.kills++;
    }

    if (teamKillObj && killerTeamId) {
        const teamInfo = TEAM_LOOKUP.get(killerTeamId);
        if (teamInfo) {
            const label = `${teamInfo.color}${teamInfo.name}`;
            teamKillObj.addScore(label, 1);
        }
    }

    scheduleSaveStats();

    handleFirstBlood(killer, victimPlayer);
    handleMultiKill(killer);
    handleKillStreak(killer);
}

export function handleDeath(player) {
    if (!player || !player.isValid) return;
    const id = player.id;

    cancelReviveForPlayer(id);

    const victimTeamId = playerTeamCache.get(id);
    const killer = resolveKiller(id);
    const cause = resolveDeathCause(id);

    if (isUHC(player)) {
        processVictimDeath(player, victimTeamId, player.location);
        killStreak.set(id, 0);
        multiKill.delete(id);
        showDeathScreenshot(player);
    }

    if (cause === 'player' && killer && isUHC(killer) && killer !== player) {
        processKillerRewards(killer, player, victimTeamId);
    }

    hitRegistry.delete(id);
}

export function onHurt(ev) {
    const hurt = ev.hurtEntity;
    if (!hurt) return;
    if (hurt.typeId !== 'minecraft:player') return;

    const source = ev.damageSource;
    const attacker = source?.damagingEntity;
    const cause = source?.cause;

    if (!attacker || attacker.typeId !== 'minecraft:player') {
        trackHit(null, hurt, cause);
        return;
    }

    if (!isUHC(attacker) || !isUHC(hurt)) {
        trackHit(null, hurt, cause);
        return;
    }

    trackHit(attacker, hurt, cause);
}
