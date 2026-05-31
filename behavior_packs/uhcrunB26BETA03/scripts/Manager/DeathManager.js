import { GameMode, ItemStack, system } from '@minecraft/server';
import { removePlayerFromAliveRuntimeState } from './CacheManager.js';
import { enqueueItemVacuum } from './ItemVacuum.js';
import { cancelReviveForPlayer } from './ReviveManager_Core.js';
import { hitRegistry, isUHC, killStreak, multiKill, playerTeamCache } from './State_Cache.js';
import { teamKillObj } from './State_Game.js';
import { deathBatchRunning, deathQueue, setDeathBatchRunning } from './State_Queue.js';
import { deathLocation, playerStats, TEAM_LOOKUP, teamStats } from './State_Team.js';
import { entityQueryOptions, particleLocPool, spawnEntityLocPool } from './State_Util.js';

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
        try {
            if (!player || !player.isValid) return;

            try {
                player.removeTag('uhc');
            } catch (err) {
                console.warn('[DeathManager] Failed to remove UHC tag:', err);
            }

            try {
                player.setGameMode(GameMode.Spectator);
            } catch (err) {
                console.warn('[DeathManager] Failed to set game mode to Spectator:', err);
            }

            enqueueItemVacuum(() => {
                try {
                    if (!player || !player.isValid) return;
                    const activeDim = player.dimension;
                    if (!activeDim) return;

                    spawnEntityLocPool.x = snapX;
                    spawnEntityLocPool.y = snapY + 1.5;
                    spawnEntityLocPool.z = snapZ;

                    try {
                        activeDim.spawnItem(new ItemStack('minecraft:player_head', 1), spawnEntityLocPool);
                    } catch (e) {
                        console.warn('[DeathManager] Failed to spawn player head:', e);
                    }

                    let cart = null;
                    try {
                        cart = activeDim.spawnEntity('minecraft:hopper_minecart', spawnEntityLocPool);
                    } catch (e) {
                        console.warn('[DeathManager] Failed to spawn hopper minecart:', e);
                    }

                    if (!cart || !cart.isValid) return;
                    const cartLoc = cart.location;

                    entityQueryOptions.location.x = snapX;
                    entityQueryOptions.location.y = snapY;
                    entityQueryOptions.location.z = snapZ;

                    const items = activeDim.getEntities(entityQueryOptions);
                    for (const item of items) {
                        if (!item || !item.isValid) continue;
                        try {
                            item.teleport(cartLoc, { dimension: activeDim });
                        } catch (e) {
                            console.warn('[DeathManager] Failed to teleport item to vacuum cart:', e);
                        }
                    }

                    system.runTimeout(() => {
                        try {
                            if (cart && cart.isValid) {
                                cart.remove();
                            }
                        } catch (err) {
                            console.warn('[DeathManager] Failed to remove vacuum cart:', err);
                        }
                    }, 30);
                } catch (err) {
                    console.warn('[DeathManager] Item vacuum execution failed:', err);
                }
            });
        } catch (err) {
            console.warn('[DeathManager] Deferred spectator transition failed:', err);
        }
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

export function HandlerOnHurt(ev) {
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
