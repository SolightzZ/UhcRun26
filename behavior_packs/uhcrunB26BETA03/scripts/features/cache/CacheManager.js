import { world } from '@minecraft/server';
import { CONFIG, TEAMS } from '../../constants/game.js';
import cacheRegistry from '../../shared/CacheRegistry.js';
import { enqueuePlayerMessage } from '../../shared/MessageBatcher.js';
import { logError } from '../../shared/Util.js';
import { isGameRunning } from '../match/State_Game.js';
import {
   aliveTeamDirtyHandler,
   clearDeathLocations,
   deathLocation,
   deleteDeathLocation,
   deletePlayerStats,
   playerStats,
   removeFromTeamIndex,
   TEAM_LOOKUP,
   teamPlayerIndex,
   teamStats,
} from '../team/State_Team.js';
import { allPlayersCache, inventoryCache, playerCache, playerTeamCache, uhcPlayerIds, uhcPlayersCache } from './State_Cache.js';
import { hitRegistry } from '../kill/HitTracker.js';
import { killStreak, multiKill } from '../kill/KillAnnouncer.js';

function removeCachedPlayerById(list, id) {
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

      if (isGameRunning && !uhcPlayerIds.has(p.id)) continue;

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
   uhcPlayerIds.clear();
   playerCache.clear();

   for (const p of players) {
      if (!p?.isValid) continue;

      allPlayersCache.push(p);
      playerCache.set(p.id, p);

      if (p.hasTag('uhc')) {
         uhcPlayersCache.push(p);
         uhcPlayerIds.add(p.id);
      }
   }

   rebuildTeamRuntimeState(players);
}

export function removePlayerFromRuntimeState(id, teamId) {
   if (teamId === undefined) {
      teamId = playerTeamCache.get(id);
   }

   if (teamId && TEAM_LOOKUP.has(teamId)) {
      removeFromTeamIndex(teamId, id);
   }

   playerTeamCache.delete(id);
}

function removePlayerFromRuntimeStateFull(id, teamId) {
   removePlayerFromRuntimeState(id, teamId);
   playerCache.delete(id);
   hitRegistry.delete(id);
   deleteDeathLocation(id);
   multiKill.delete(id);
   killStreak.delete(id);
   inventoryCache.delete(id);
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

   removeFromTeamIndex(resolvedTeamId, id);
   aliveTeamDirtyHandler();
}

export function getPlayerInventoryContainer(player) {
   if (!player?.isValid) return null;
   const cached = inventoryCache.get(player.id);
   if (cached) return cached;
   try {
      const container = player.getComponent('minecraft:inventory')?.container ?? null;
      if (container) inventoryCache.set(player.id, container);
      return container;
   } catch (error) {
      logError('Cache', 'Failed to get inventory', error);
      return null;
   }
}

export function purgePlayerCacheOnLeave(id) {
   if (!id) return;

   const teamId = playerTeamCache.get(id);
   const isCounted = !isGameRunning || uhcPlayerIds.has(id);
   const countedTeamId = isCounted ? teamId : null;

   removePlayerFromRuntimeStateFull(id, countedTeamId);

   removeCachedPlayerById(allPlayersCache, id);
   removeCachedPlayerById(uhcPlayersCache, id);

   inventoryCache.delete(id);
   deleteDeathLocation(id);
   deletePlayerStats(id);

   aliveTeamDirtyHandler();

   cacheRegistry.purgePlayer(id);
}

export function dumpCacheInfo(player) {
   const msg =
      `§b[UHC Cache] Current Sizes:\n` +
      `§7allPlayersCache: §f${allPlayersCache.length}\n` +
      `§7uhcPlayersCache: §f${uhcPlayersCache.length}\n` +
      `§7playerCache: §f${playerCache.size}\n` +
      `§7playerTeamCache: §f${playerTeamCache.size}\n` +
      `§7hitRegistry: §f${hitRegistry.size}\n` +
      `§7multiKill: §f${multiKill.size}\n` +
      `§7killStreak: §f${killStreak.size}\n` +
      `§7inventoryCache: §f${inventoryCache.size}\n` +
      `§7uhcPlayerIds: §f${uhcPlayerIds.size}\n` +
      `§7playerStats (State_Team): §f${playerStats.size}\n` +
      `§7teamStats (State_Team): §f${teamStats.size}\n` +
      `§7deathLocation (State_Team): §f${deathLocation.size}`;
   if (player?.isValid && typeof player.sendMessage === 'function') {
      enqueuePlayerMessage(player, msg);
   } else {
      logError('Cache', 'dumpCacheInfo: invalid player, cannot send message');
   }
}

export function clearRuntimeCaches() {
   hitRegistry.clear();
   multiKill.clear();
   killStreak.clear();
   inventoryCache.clear();
   refreshPlayerCaches();
}

export function clearAllCachesIncludingStats() {
   playerStats.clear();
   teamStats.clear();
   clearDeathLocations();
   clearRuntimeCaches();
}
