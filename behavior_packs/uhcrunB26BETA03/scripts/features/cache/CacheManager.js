//นำเข้า state และ dependencies สำหรับจัดการ cache ผู้เล่น
import { world } from '@minecraft/server';
import { CONFIG, TEAMS } from '../../constants/game.js';
import { isGameRunning } from '../match/State_Game.js';

import {
   aliveTeamDirtyHandler,
   clearDeathLocations,
   deathLocation,
   deleteDeathLocation,
   deletePlayerStats,
   playerStats,
   removeFromTeamIndex,
   setTeamCount,
   TEAM_LOOKUP,
   teamCounts,
   teamPlayerIndex,
   teamStats,
} from '../team/State_Team.js';
import { allPlayersCache, allPlayersCacheIds, hitRegistry, inventoryCache, killStreak, multiKill, playerCache, playerTeamCache, uhcPlayerIds, uhcPlayersCache } from './State_Cache.js';
import { logError } from '../../shared/Util.js';

//ลบผู้เล่นออกจาก array โดยสลับกับตัวสุดท้ายเพื่อประสิทธิภาพ
export function removeCachedPlayerById(list, id) {
   if (!list || list.length === 0) return;
   const index = list.findIndex((p) => p?.id === id);
   if (index === -1) return;
   const lastIndex = list.length - 1;
   if (index !== lastIndex) {
      list[index] = list[lastIndex];
   }
   list.pop();
}

//รีเซ็ตจำนวนและ index ผู้เล่นของทุกทีม
export function clearTeamRuntimeState() {
   for (const team of TEAMS) {
      setTeamCount(team.id, 0);
      teamPlayerIndex.set(team.id, new Set());
   }
}

//สร้าง runtime state ใหม่จากรายชื่อผู้เล่นปัจจุบัน
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

      let count = teamCounts.get(teamId);
      if (!Number.isFinite(count)) {
         count = 0;
      }
      count = count + 1;
      setTeamCount(teamId, count);

      const set = teamPlayerIndex.get(teamId);
      if (set) {
         set.add(p.id);
      }
   }
}

export function refreshPlayerCaches() {
   const players = world.getPlayers();

   // แก้ไขในตำแหน่งเดิมเพื่อรักษาความสมบูรณ์ของข้อมูลอ้างอิงในการนำเข้าทั้งหมด
   allPlayersCache.length = 0;
   uhcPlayersCache.length = 0;
   allPlayersCacheIds.clear();
   uhcPlayerIds.clear();
   playerCache.clear();

   for (const p of players) {
      if (!p?.isValid) continue;

      allPlayersCache.push(p);
      allPlayersCacheIds.add(p.id);
      playerCache.set(p.id, p);

      if (p.hasTag('uhc')) {
         uhcPlayersCache.push(p);
         uhcPlayerIds.add(p.id);
      }
   }

   rebuildTeamRuntimeState(players);
}

export function removePlayerFromRuntimeState(id, teamId, fullCleanup) {
   if (teamId === undefined) {
      teamId = playerTeamCache.get(id);
   }

   if (fullCleanup === undefined) {
      fullCleanup = false;
   }

   if (teamId && TEAM_LOOKUP.has(teamId)) {
      removeFromTeamIndex(teamId, id);

      let count = teamCounts.get(teamId);
      if (!Number.isFinite(count)) {
         count = 0;
      }

      count = count - 1;
      if (count < 0) {
         count = 0;
      }
      setTeamCount(teamId, count);
   }

   playerTeamCache.delete(id);

   if (!fullCleanup) return;

   playerCache.delete(id);
   hitRegistry.delete(id);
   deleteDeathLocation(id);
   multiKill.delete(id);
   killStreak.delete(id);
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

   const count = teamCounts.get(resolvedTeamId) ?? 0;
   setTeamCount(resolvedTeamId, count > 0 ? count - 1 : 0);
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

   removePlayerFromRuntimeState(id, countedTeamId, true);

   removeCachedPlayerById(allPlayersCache, id);
   allPlayersCacheIds.delete(id);
   removeCachedPlayerById(uhcPlayersCache, id);

   inventoryCache.delete(id);
   deleteDeathLocation(id);
   deletePlayerStats(id);

   aliveTeamDirtyHandler();
}
