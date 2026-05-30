import { GameMode, system, world } from '@minecraft/server';
import utilUmm from '../system/UtilUhcMatchManager.js';
import { CONFIG, TEAMS } from './UtilTeamManager.js';

import {
  aliveTeamDirtyHandler,
  allPlayersCache,
  allPlayersCacheIds,
  deathLocation,
  GlobalPlayerCaches,
  isGameRunning,
  itemVacuumQueue,
  playerCache,
  playerStats,
  playerTeamCache,
  REVIVE_ITEM_ID,
  setAliveTeamDirtyHandler,
  setKdHistoryObj,
  setTeamKillObj,
  teamCounts,
  teamPlayerIndex,
  teamStats,
  teleportLocPool,
  uhcPlayerIds,
  uhcPlayersCache,
} from './State.js';

import { checkAllCaches, clearAllCaches, clearAllCachesIncludingStats, rebuildTeamRuntimeState, refreshPlayerCaches, removeCachedPlayerById, removePlayerFromRuntimeState } from './CacheManager.js';
import { handleDeath, onHurt } from './DeathManager.js';
import { AdminMenu, openMainMenu, showTeleportForm, teleportToSpawn, tpa } from './MenuManager.js';
import { cancelReviveForPlayer, onUseReviveItem } from './ReviveManager.js';
import { flushSidebarUpdates, refreshScoreboardUI, updateSidebar } from './ScoreboardManager.js';
import { resetAnnouncer, scheduleSaveStats } from './StatsManager.js';
import { clearAllTaguhcAndDynamicProperty, clearAllTeams, getCachedPlayers, getPlayersByTeam, getPlayerTeam, setTeam } from './TeamActions.js';

import { TEAM_INDEX_MAP, TEAM_LOOKUP } from './State.js';

// ======================================================
//  Public API Exports
// ======================================================

export { getPlayerTeam, refreshPlayerCaches, refreshScoreboardUI };
export function getTeams() {
    return TEAMS;
}
export function getTeamInfo(teamId) {
    return TEAM_LOOKUP.get(teamId) ?? null;
}
export { getCachedPlayers as getAllPlayers };
export const getUhcPlayers = () => uhcPlayersCache;
export { getKdHistoryObjective, getTeamKillObjective, setGameRunningState } from './State.js';
export {
  AdminMenu,
  checkAllCaches,
  clearAllCaches,
  clearAllCachesIncludingStats,
  clearAllTaguhcAndDynamicProperty,
  clearAllTeams,
  getPlayersByTeam,
  openMainMenu,
  setAliveTeamDirtyHandler as registerAliveTeamDirtyHandler,
  resetAnnouncer,
  showTeleportForm,
  teleportToSpawn,
  tpa
};
export function getPlayerStats() {
    return playerStats;
}
export function getTeamStats() {
    return teamStats;
}

export function getPlayerName(id) {
    return playerCache.get(id)?.name ?? null;
}

export function isPlayerUhcId(id) {
    return uhcPlayerIds.has(id);
}

export function clearAllPlayerNametags() {
    let index = 0;
    const task = system.runInterval(() => {
        const players = world.getPlayers();
        const total = players.length;
        if (index >= total) {
            system.clearRun(task);
            console.warn('Clear All Player Nametags');
            return;
        }
        for (let i = 0; i < 3 && index < total; i++, index++) {
            const p = players[index];
            if (!p?.isValid) continue;
            if (p.nameTag === p.name) continue;
            p.nameTag = p.name;
        }
    }, 1);
}

export function showVictoryMessage(winnerTeamId, uhcTick = 0) {
    const teamInfo = TEAM_LOOKUP.get(winnerTeamId);
    if (!teamInfo) return;

    const teamStat = teamStats.get(winnerTeamId) ?? { kills: 0, deaths: 0 };
    let playerLine = '';
    for (const [playerId, ps] of playerStats.entries()) {
        const teamId = ps.teamId ?? playerTeamCache.get(playerId);
        if (teamId !== winnerTeamId) continue;
        const onlinePlayer = playerCache.get(playerId);
        const name = onlinePlayer?.isValid ? onlinePlayer.name : (ps.name ?? playerId);
        playerLine += `${teamInfo.color}${name} §7- §c${ps.kills} Kill\n`;
    }
    if (!playerLine) playerLine = '§7No players\n';

    const totalSeconds = uhcTick;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    world.sendMessage(
        `\n§7=======================================\n§6      UHC RUN26 MATCH FINISHED\n§7=======================================\n\n§eVICTORY ${teamInfo.color}${teamInfo.name}§r\n\n§ePLAYERS\n${playerLine}\n§eSTATS\n§7 » Total Kills: §c${teamStat.kills}\n§7 » Match Time: §e${minutes}m ${seconds}s\n\n§9 » Sleeplite SMP: discord.gg/gtqfbmvTJK\n\n§7=======================================\n\n`,
    );
}

// ======================================================
//  Event Handlers
// ======================================================

function onDeath(ev) {
    const dead = ev.deadEntity;
    if (!dead) return;
    if (dead.typeId !== 'minecraft:player') return;
    if (!dead.isValid) return;
    handleDeath(dead);
}

function onSpawn(ev) {
    const player = ev.player;
    if (!player) return;
    const id = player.id;
    playerCache.set(id, player);

    const spawnPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
    spawnPs.name = player.name;
    const cachedTeamId = playerTeamCache.get(id);
    const dynamicProp = player.getDynamicProperty(CONFIG.key);
    const propTeamId = typeof dynamicProp === 'string' ? dynamicProp : null;
    const spawnTeamId = cachedTeamId ?? propTeamId;
    if (spawnTeamId) spawnPs.teamId = spawnTeamId;
    playerStats.set(id, spawnPs);
    scheduleSaveStats();

    if (!allPlayersCacheIds.has(id)) {
        allPlayersCache.push(player);
        allPlayersCacheIds.add(id);
    }

    if (player.hasTag('uhc') && !uhcPlayerIds.has(id)) {
        uhcPlayersCache.push(player);
        uhcPlayerIds.add(id);
    }

    if (!ev.initialSpawn) {
        const loc = deathLocation.get(id);
        if (loc) {
            const dimension = player.dimension ?? world.getDimension('overworld');
            teleportLocPool.x = loc.x + 0.5;
            teleportLocPool.y = loc.y;
            teleportLocPool.z = loc.z + 0.5;
            player.teleport(teleportLocPool, { dimension });
        }
    }

    const dynamicTeam = propTeamId ?? cachedTeamId;

    if (isGameRunning && !player.hasTag('uhc')) {
        player.setGameMode(GameMode.Spectator);
        player.addEffect('conduit_power', 1, { amplifier: 255, showParticles: false });
        return;
    }

    if (ev.initialSpawn && !isGameRunning) {
        teleportToSpawn(player);
        player.setGameMode(GameMode.Adventure);
        utilUmm.playerSetupClearItemsKeepCompass(player);
    }

    if (!dynamicTeam) return;

    const inCache = playerTeamCache.has(id);

    if ((!inCache && !isGameRunning) || player?.hasTag('uhc')) {
        const before = teamCounts.get(dynamicTeam) ?? 0;
        teamCounts.set(dynamicTeam, before + 1);
        teamPlayerIndex.get(dynamicTeam)?.add(id);
        updateSidebar(dynamicTeam);
    }

    setTeam(player, dynamicTeam);
}

function onLeave(ev) {
    const id = ev.playerId;
    if (!id) return;
    cancelReviveForPlayer(id);
    const teamId = playerTeamCache.get(id);
    const isCounted = !isGameRunning || uhcPlayerIds.has(id);
    const countedTeamId = isCounted ? teamId : null;
    removePlayerFromRuntimeState(id, countedTeamId, true);

    removeCachedPlayerById(allPlayersCache, id);
    allPlayersCacheIds.delete(id);
    removeCachedPlayerById(uhcPlayersCache, id);

    if (itemVacuumQueue.length > 0) deathLocation.delete(id);

    aliveTeamDirtyHandler();
    GlobalPlayerCaches.delete(id);
}

function onChat(ev) {
    const player = ev.sender;
    if (!player || !player.isValid) return;
    const message = ev.message;
    if (!message) return;
    const trimmed = message.trim();
    if (trimmed.length === 0) return;
    if (trimmed[0] === '!') return;
    const teamId = playerTeamCache.get(player.id);
    if (!teamId) return;
    const teamInfo = TEAM_LOOKUP.get(teamId);
    if (!teamInfo) return;
    const teamIndexRaw = TEAM_INDEX_MAP.get(teamId);
    const teamIndex = (teamIndexRaw ?? -1) + 1;
    ev.cancel = true;
    const formattedMessage = `[${teamIndex}] ${teamInfo.color}${player.name}§r: ${trimmed}`;
    world.sendMessage(formattedMessage);
}

// ======================================================
//  Event Subscriptions
// ======================================================

world.beforeEvents.chatSend.subscribe(onChat);
world.afterEvents.entityDie.subscribe(onDeath);
world.afterEvents.entityHurt.subscribe(onHurt);
world.afterEvents.playerSpawn.subscribe(onSpawn);
world.afterEvents.playerLeave.subscribe(onLeave);

world.afterEvents.itemUse.subscribe((ev) => {
    const { source, itemStack } = ev;
    if (!source?.isValid) return;
    const itemId = itemStack?.typeId;
    if (itemId === REVIVE_ITEM_ID) {
        system.run(() => onUseReviveItem(source));
        return;
    }
    if (itemId !== 'minecraft:compass') return;
    const isAdmin = source.hasTag(CONFIG.adminTag);
    const isUhc = source.hasTag('uhc');
    if (!isAdmin && isUhc) return;
    system.run(() => openMainMenu(source));
});

// ======================================================
//  Init: Player Cache + Scoreboard
// ======================================================

system.run(() => {
    const players = world.getPlayers();
    for (let i = 0; i < players.length; i++) {
        const p = players[i];
        if (!p?.isValid) continue;
        playerCache.set(p.id, p);
    }
    rebuildTeamRuntimeState(players);
    flushSidebarUpdates();
});

// ======================================================
//  Init: Scoreboard Objectives
// ======================================================

system.run(() => {
    const sb = world.scoreboard;
    if (!sb) return;
    let obj = sb.getObjective('kdhistory');
    if (!obj) obj = sb.addObjective('kdhistory', 'KD History');
    setKdHistoryObj(obj);
    let teamObj = sb.getObjective('uhc_teamkills');
    if (!teamObj) teamObj = sb.addObjective('uhc_teamkills', 'Team Kills');
    setTeamKillObj(teamObj);
});

// ======================================================
//  Init: Stats from Dynamic Properties
// ======================================================

system.run(() => {
    const dTeam = world.getDynamicProperty('uhc_teamStats');
    const parsedTeamStats = safeParseDynamicMap(dTeam, 'uhc_teamStats');
    if (parsedTeamStats) {
        const entries = Object.entries(parsedTeamStats);
        for (let i = 0; i < entries.length; i++) {
            const [k, v] = entries[i];
            if (!v) continue;
            if (!teamStats.has(k)) continue;
            const kills = Number.isFinite(Number(v.kills)) ? Number(v.kills) : 0;
            const deaths = Number.isFinite(Number(v.deaths)) ? Number(v.deaths) : 0;
            teamStats.set(k, { kills, deaths });
        }
    }

    const dPlayer = world.getDynamicProperty('uhc_playerStats');
    const parsedPlayerStats = safeParseDynamicMap(dPlayer, 'uhc_playerStats');
    if (parsedPlayerStats) {
        const entries = Object.entries(parsedPlayerStats);
        for (let i = 0; i < entries.length; i++) {
            const [k, v] = entries[i];
            if (!v) continue;
            if (typeof k !== 'string' || k.length === 0) continue;
            const kills = Number.isFinite(Number(v.kills)) ? Number(v.kills) : 0;
            const deaths = Number.isFinite(Number(v.deaths)) ? Number(v.deaths) : 0;
            playerStats.set(k, {
                kills,
                deaths,
                name: typeof v.name === 'string' ? v.name : undefined,
                teamId: typeof v.teamId === 'string' ? v.teamId : undefined,
            });
        }
    }
});

function safeParseDynamicMap(rawValue, label) {
    if (typeof rawValue !== 'string' || rawValue.length === 0) return null;
    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            console.warn(`[UHC] Ignored invalid ${label} dynamic property payload.`);
            return null;
        }
        return parsed;
    } catch (error) {
        console.warn(`[UHC] Failed to parse ${label} dynamic property: ` + error);
        return null;
    }
}

// ======================================================
//  Admin Chat Commands (!check, !clear, !clearall)
// ======================================================

world.beforeEvents.chatSend.subscribe((ev) => {
    const player = ev.sender;
    if (!player?.isValid) return;
    const message = ev.message.toLowerCase();

    switch (message) {
        case '!เช็ค':
        case '!check':
            if (!player.hasTag(CONFIG.adminTag)) {
                player.sendMessage("§c[Cache] You don't have permission!");
                return;
            }
            ev.cancel = true;
            system.run(() => {
                const result = checkAllCaches();
                player.sendMessage(result.message);
                console.warn('[Cache Check]\n' + result.message.replace(/§./g, ''));
            });
            break;

        case '!ลบ':
        case '!clear':
            if (!player.hasTag(CONFIG.adminTag)) {
                player.sendMessage("§c[Cache] You don't have permission!");
                return;
            }
            ev.cancel = true;
            system.run(() => {
                const result = clearAllCaches();
                player.sendMessage(result.message);
                world.sendMessage(`§e[Cache] §f${player.name} §7cleared cache`);
                console.warn('[Cache Clear]\n' + result.message.replace(/§./g, ''));
            });
            break;

        case '!ลบทั้งหมด':
        case '!clearall':
            if (!player.hasTag(CONFIG.adminTag)) {
                player.sendMessage("§c[Cache] You don't have permission!");
                return;
            }
            ev.cancel = true;
            system.run(() => {
                const result = clearAllCachesIncludingStats();
                player.sendMessage(result.message);
                world.sendMessage(`§c[Cache] §f${player.name} §7cleared ALL cache (including stats)`);
                console.warn('[Cache Clear All]\n' + result.message.replace(/§./g, ''));
            });
            break;
    }
});
