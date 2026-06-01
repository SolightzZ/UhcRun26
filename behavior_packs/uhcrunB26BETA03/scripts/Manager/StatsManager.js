import { system, world } from '@minecraft/server';
import { dynamicToast } from '../plugin/Util.js';
import { allPlayersCacheIds, hitRegistry, killStreak, multiKill, playerCache, playerTeamCache } from './State_Cache.js';
import { HIT_TIMEOUT_TICKS, MULTI_TIMEOUT_TICKS, firstBloodDone, kdHistoryObj, setFirstBloodDone, setStatsDirty, setStatsSaveTask, statsDirty, statsSaveTask } from './State_Game.js';
import { TEAM_LOOKUP, playerStats, teamStats } from './State_Team.js';

export function scheduleSaveStats() {
    setStatsDirty(true);
    if (statsSaveTask !== null) return;
    setStatsSaveTask(system.runTimeout(runSaveStats, 60));
}

function runSaveStats() {
    setStatsSaveTask(null);
    if (!statsDirty) return;
    setStatsDirty(false);
    saveTeamStats();
    system.runTimeout(savePlayerStats, 2);
}

function saveTeamStats() {
    try {
        const data = Object.fromEntries(teamStats);
        const json = JSON.stringify(data);
        world.setDynamicProperty('uhc_teamStats', json);
    } catch (e) {
        console.error('[UHC] saveStats teamStats failed:', e);
    }
}

function savePlayerStats() {
    try {
        const data = Object.fromEntries(playerStats);
        const json = JSON.stringify(data);
        world.setDynamicProperty('uhc_playerStats', json);
    } catch (e) {
        console.error('[UHC] saveStats playerStats failed:', e);
    }
}

function incrementPairHistory(killer, victim) {
    if (!kdHistoryObj) return;
    if (!killer) return;
    if (!victim) return;
    if (!killer.isValid) return;
    if (!victim.isValid) return;

    const killerName = killer.name;
    const victimName = victim.name;
    const historyKey = 'Kill: ' + killerName + ' | Victim : ' + victimName;

    kdHistoryObj.addScore(historyKey, 1);
}

function handleMultiKill(killer) {
    if (!killer) return;
    if (!killer.isValid) return;

    const id = killer.id;
    const now = system.currentTick;
    let data = multiKill.get(id);
    if (!data) {
        data = { count: 1, tick: now };
        multiKill.set(id, data);
    } else {
        if (now - data.tick > MULTI_TIMEOUT_TICKS) {
            data.count = 1;
            data.tick = now;
        } else {
            data.count = data.count + 1;
            data.tick = now;
        }
    }

    let count = data.count;
    if (count > 5) {
        count = 5;
    }

    const MULTI_KILL_DATA = [
        null,
        { text: '§eKILL', sound: 'kill1' },
        { text: '§6DOUBLE KILL', sound: 'kill2' },
        { text: '§cTRIPLE KILL', sound: 'kill3' },
        { text: '§5QUADRA KILL', sound: 'kill4' },
        { text: '§4ACE', sound: 'kill5' },
    ];

    const info = MULTI_KILL_DATA[count];
    if (!info) return;
    const message = info.text + ' §7| §f' + killer.name;
    world.sendMessage(dynamicToast(message, 'textures/ui/icons/icon_multiplayer'));
    world.sendMessage(message);
    killer.playSound(info.sound);
}

function handleKillStreak(killer) {
    if (!killer) return;
    if (!killer.isValid) return;
    let current = killStreak.get(killer.id);
    if (current === undefined) {
        current = 0;
    }
    current = current + 1;
    killStreak.set(killer.id, current);
}

function handleFirstBlood(killer, victim) {
    if (!killer) return;
    if (!victim) return;
    if (!killer.isValid) return;
    if (!victim.isValid) return;
    if (firstBloodDone) return;

    setFirstBloodDone(true);
    const message = '§cFIRST BLOOD §7| ' + killer.name + ' > §f' + victim.name;
    world.sendMessage(dynamicToast(message, 'textures/ui/friend_glyph_desaturated'));
    world.sendMessage(message);
    killer.playSound('mob.wither.death');
}

export function resetAnnouncer() {
    multiKill.clear();
    killStreak.clear();
    setFirstBloodDone(false);

    for (const p of world.getPlayers()) {
        if (!p?.isValid) continue;
        const tag = p.nameTag;
        if (!tag) continue;
        if (tag === p.name) continue;
        if (!tag.includes('\n')) continue;
        p.nameTag = p.name;
    }

    console.warn('[UHC] Announcer System Reset.');
}

export function trackHit(attacker, victim, cause) {
    if (!victim) return;
    const victimId = victim.id;
    if (!victimId) return;

    const attackerId = attacker?.id;
    const isSelfInflicted = !!attackerId && attackerId === victimId;

    let finalCause = cause;
    if (!finalCause) {
        finalCause = 'unknown';
    }

    const currentTick = system.currentTick;
    const existing = hitRegistry.get(victimId);
    const nextAttackerId = isSelfInflicted ? null : attackerId;

    if (existing?.tick === currentTick && existing.attackerId === nextAttackerId && existing.cause === finalCause && existing.isSelfInflicted === isSelfInflicted) {
        return;
    }

    if (!existing) {
        hitRegistry.set(victimId, {
            attackerId: nextAttackerId,
            cause: finalCause,
            damageType: finalCause,
            tick: currentTick,
            isSelfInflicted,
        });
        return;
    }

    const existingHasRecentPlayerAttacker = !!existing.attackerId && currentTick - existing.tick <= HIT_TIMEOUT_TICKS;

    if (isSelfInflicted) {
        if (!existingHasRecentPlayerAttacker) {
            existing.attackerId = null;
            existing.isSelfInflicted = true;
        }
    } else if (attackerId || !existingHasRecentPlayerAttacker) {
        existing.attackerId = attackerId;
        existing.isSelfInflicted = false;
    } else {
        existing.isSelfInflicted = false;
    }
    existing.cause = finalCause;
    existing.damageType = finalCause;
    existing.tick = currentTick;
}

export function handlerHit() {
    const currentTick = system.currentTick;
    for (const [victimId, entry] of hitRegistry.entries()) {
        if (!entry) {
            hitRegistry.delete(victimId);
            continue;
        }
        if (!allPlayersCacheIds.has(victimId)) {
            hitRegistry.delete(victimId);
            continue;
        }
        if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
            hitRegistry.delete(victimId);
        }
    }
}

function getRecentHitEntry(victimId) {
    if (!victimId) return null;
    const entry = hitRegistry.get(victimId);
    if (!entry) return null;

    const currentTick = system.currentTick;
    if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
        hitRegistry.delete(victimId);
        return null;
    }

    return entry;
}

function resolveKiller(victimId) {
    const entry = getRecentHitEntry(victimId);
    if (!entry?.attackerId) return null;

    const killer = playerCache.get(entry.attackerId);
    if (!killer) return null;
    if (!killer.isValid) return null;
    return killer;
}

function resolveDeathCause(victimId) {
    const entry = getRecentHitEntry(victimId);
    if (!entry) return 'environment';

    if (entry.isSelfInflicted) return 'self';
    if (!entry.attackerId) return entry.damageType ?? entry.cause ?? 'environment';
    return 'player';
}

function getKillerDisplay(player) {
    const resolvedKiller = resolveKiller(player.id);
    if (!resolvedKiller?.isValid || resolvedKiller.id === player.id) {
        return getEnvironmentDeath(player.id);
    }

    const teamId = playerTeamCache.get(resolvedKiller.id);
    if (!teamId) return resolvedKiller.name;

    const team = TEAM_LOOKUP.get(teamId);
    if (!team) return resolvedKiller.name;

    return `${team.color}${resolvedKiller.name}§r`;
}

function getEnvironmentDeath(playerId) {
    switch (resolveDeathCause(playerId)) {
        case 'fall':
            return 'fall damage';
        case 'lava':
            return 'lava';
        case 'fire':
        case 'fire_tick':
            return 'fire';
        case 'drowning':
            return 'drowning';
        case 'void':
            return 'the void';
        case 'explosion':
            return 'explosion';
        case 'projectile':
            return 'shot';
        case 'entityAttack':
        case 'entity_attack':
            return 'mob attack';
        case 'self':
            return 'self-inflicted damage';
        case 'player':
            return 'player attack';
        case 'environment':
            return 'environment';
        default:
            return 'died';
    }
}

function getDeathDisplayInfo(player) {
    const resolvedKiller = resolveKiller(player.id);
    if (resolvedKiller?.isValid && resolvedKiller.id !== player.id) {
        return {
            isPlayerKill: true,
            text: getKillerDisplay(player),
        };
    }

    const cause = resolveDeathCause(player.id);
    return {
        isPlayerKill: false,
        cause,
        text: getEnvironmentDeath(player.id),
    };
}

function showDeathUI(player, deathInfo) {
    const subtitle = deathInfo?.isPlayerKill ? `§7Killed by ${deathInfo.text}` : `§7Cause: ${deathInfo?.text ?? 'unknown'}`;

    player.onScreenDisplay.setTitle('§cYOU DIED', {
        fadeInDuration: 10,
        stayDuration: 80,
        fadeOutDuration: 100,
        subtitle,
    });
    player.playSound('random.orb', {
        volume: 1,
        pitch: 0.6,
    });
}

function sendDeathMessage(player, deathInfo) {
    const stats = playerStats.get(player.id) ?? { kills: 0, deaths: 0 };
    const detailLine = deathInfo?.isPlayerKill ? `§eKilled by §r${deathInfo.text}` : `§eCause: §r${deathInfo?.text ?? 'unknown'}`;

    player.sendMessage(
        `\n` +
            `§7==========================\n` +
            `§c            YOU DIED\n` +
            `§7==========================\n\n` +
            `${detailLine}\n\n` +
            `§eSTATS\n` +
            `§7 » Kills: §c${stats.kills}\n` +
            `§7 » Deaths: §c${stats.deaths}\n\n` +
            `§9 » Sleeplite: discord.gg/gtqfbmvTJK\n\n` +
            `§7==========================\n\n`,
    );
}

export {
    getDeathDisplayInfo,
    getEnvironmentDeath,
    getKillerDisplay,
    handleFirstBlood,
    handleKillStreak,
    handleMultiKill,
    incrementPairHistory,
    resolveDeathCause,
    resolveKiller,
    sendDeathMessage,
    showDeathUI,
};
