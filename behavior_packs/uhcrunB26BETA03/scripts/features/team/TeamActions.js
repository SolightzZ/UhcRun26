//จัดการทีม: join, leave, set, clear และ nametag (backend only)
import { system, world } from '@minecraft/server';
import { CONFIG, TEAM_MENU, TEAMS } from '../../constants/game.js';
import { dynamicToast, logError, logWarn, SND_BASS, TEX_CANCEL } from '../../shared/Util.js';
import { clearTeamRuntimeState, refreshPlayerCaches, removePlayerFromRuntimeState } from '../cache/CacheManager.js';
import { allPlayersCache, allPlayersCacheIds, hitRegistry, playerCache, playerTeamCache, uhcPlayersCache } from '../cache/State_Cache.js';
import { isGameRunning, teamKillObj } from '../match/State_Game.js';
import { clearAllReviveRuntime } from '../revive/State_Revive.js';
import { resetAllStats, resetAnnouncer, scheduleSaveStats } from '../stats/StatsManager.js';
import {
   addToTeamIndex,
   aliveTeamDirtyHandler,
   clearDeathLocations,
   playerStats,
   removeFromTeamIndex,
   setPlayerStats,
   setTeamCount,
   TEAM_INDEX_MAP,
   TEAM_LOOKUP,
   teamCounts,
   teamPlayerIndex,
} from './State_Team.js';

const dirtyNametagIds = new Set();
let nametagFlushTask = null;

// อัปเดตบางฟิลด์ของ playerStats โดยไม่ลบของเก่า
function patchPlayerStats(playerId, patch) {
   const ps = playerStats.get(playerId) ?? { kills: 0, deaths: 0 };
   if (patch.name !== undefined) ps.name = patch.name;
   if (patch.teamId !== undefined) ps.teamId = patch.teamId;
   setPlayerStats(playerId, ps);
   return ps;
}

//สราง nametag แบบมี index สีทีม
function formatTeamNametag(player, teamId) {
   const teamInfo = TEAM_LOOKUP.get(teamId);
   if (!teamInfo) return player.name;
   const teamIndex = (TEAM_INDEX_MAP.get(teamId) ?? -1) + 1;
   return `[${teamIndex}] ${teamInfo.color}${player.name}`;
}

//อัปเดต nametag ของผู้เล่นที่ต้องเปลี่ยน
function flushNametagUpdates() {
   const dirtyArr = Array.from(dirtyNametagIds);
   for (let di = 0, dLen = dirtyArr.length; di < dLen; di++) {
      const id = dirtyArr[di];
      const player = playerCache.get(id);
      if (!player?.isValid) continue;
      const teamId = playerTeamCache.get(id);
      player.nameTag = teamId ? formatTeamNametag(player, teamId) : player.name;
   }
   dirtyNametagIds.clear();
}

//ทำเครื่องหมายว่าต้องอัปเดต nametag (flush 1 tick ถัดไป)
function markNametagDirty(playerId) {
   if (!playerId) return;
   dirtyNametagIds.add(playerId);
   if (nametagFlushTask !== null) return;
   nametagFlushTask = system.runTimeout(() => {
      nametagFlushTask = null;
      flushNametagUpdates();
   }, 1);
}

// นับผู้เล่นทั้งหมดทุกทีม
export function getTotalTeamPlayers() {
   let total = 0;
   for (const count of teamCounts.values()) {
      total += count;
   }
   return total;
}

// ตรวจสอบว่ายังมีที่ว่างให้เข้าร่วมทีมไหม
function canJoinTeam(newTeamId) {
   const totalBefore = getTotalTeamPlayers();
   return totalBefore < CONFIG.maxTotalPlayers;
}

// จำนวนผู้เล่นในทีม
export function getTeamPlayerCount(teamId) {
   return teamCounts.get(teamId) ?? 0;
}

export function getCachedPlayers() {
   return allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
}

// อ่านทีมปัจจุบันของผู้เล่น (cache ก่อน, แล้วค่อย dynamic property)
export function getPlayerTeam(player) {
   if (!player?.isValid) return null;
   const cachedTeamId = playerTeamCache.get(player.id);
   if (cachedTeamId && TEAM_LOOKUP.has(cachedTeamId)) {
      return cachedTeamId;
   }

   const dynamicTeamId = player.getDynamicProperty(CONFIG.key);
   if (dynamicTeamId && TEAM_LOOKUP.has(dynamicTeamId)) {
      return dynamicTeamId;
   }

   return null;
}

// sync tag กับทีมเก่า/ใหม่
function syncTag(player, oldTeamId, newTeamId) {
   if (oldTeamId === newTeamId) return;

   if (oldTeamId && oldTeamId.length > 0 && player.hasTag(oldTeamId)) {
      player.removeTag(oldTeamId);
   }

   if (!newTeamId || newTeamId.length === 0 || !TEAM_LOOKUP.has(newTeamId)) return;

   if (!player.hasTag(newTeamId)) {
      player.addTag(newTeamId);
   }
}

// กำหนดทีมให้ผู้เล่น
export function setTeam(player, teamId, options = {}) {
   if (!player?.id) return;
   const scheduleSave = options.scheduleSave !== false;
   const oldTeamId = playerTeamCache.get(player.id) ?? null;
   if (oldTeamId === teamId) return;
   const shouldTrack = !isGameRunning || player?.hasTag('uhc');

   if (oldTeamId && shouldTrack) {
      removeFromTeamIndex(oldTeamId, player.id);
   }

   if (teamId) {
      player.setDynamicProperty(CONFIG.key, teamId);
      playerTeamCache.set(player.id, teamId);
      if (shouldTrack) {
         addToTeamIndex(teamId, player.id);
      }

      patchPlayerStats(player.id, { name: player.name, teamId });
      markNametagDirty(player.id);
      if (scheduleSave) scheduleSaveStats();
   } else {
      player.setDynamicProperty(CONFIG.key, null);
      playerTeamCache.delete(player.id);
      markNametagDirty(player.id);
   }

   syncTag(player, oldTeamId, teamId ?? null);
   aliveTeamDirtyHandler();
}

// ให้ผู้เล่นเข้าร่วมทีม
export function joinTeam(player, newTeamId) {
   if (!TEAM_LOOKUP.has(newTeamId)) return;

   const oldTeam = getPlayerTeam(player);
   if (oldTeam === newTeamId) return;

   const shouldTrack = !isGameRunning || player?.hasTag('uhc');

   if (shouldTrack && !oldTeam && !canJoinTeam(newTeamId)) {
      player.sendMessage(dynamicToast(TEAM_MENU.serverFull(CONFIG.maxTotalPlayers), TEX_CANCEL));
      player.playSound(SND_BASS);
      return;
   }

   if (shouldTrack && oldTeam) {
      const oldCount = teamCounts.get(oldTeam) ?? 0;
      setTeamCount(oldTeam, oldCount > 0 ? oldCount - 1 : 0);
   }

   if (shouldTrack) {
      const newCount = teamCounts.get(newTeamId) ?? 0;
      setTeamCount(newTeamId, newCount + 1);
   }

   setTeam(player, newTeamId);
}

// ให้ผู้เล่นออกจากทีม
export function leaveTeam(player) {
   const oldTeam = getPlayerTeam(player);
   if (!oldTeam) return;

   const shouldTrack = !isGameRunning || player?.hasTag('uhc');

   if (shouldTrack) {
      const current = teamCounts.get(oldTeam) ?? 0;
      setTeamCount(oldTeam, current > 0 ? current - 1 : 0);
   }
   setTeam(player, null);
}

// ลบทีมและคืนค่าผู้เล่นทุกคน (ไม่ลบ uhc tag)
export function clearAllTeams(executor) {
   if (executor && !executor.hasTag(CONFIG.adminTag)) return;
   refreshPlayerCaches();
   clearAllReviveRuntime();

   const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
   const teamsLen = TEAMS.length;

   clearTeamRuntimeState();

   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const player = players[pi];
      if (!player?.isValid) continue;

      const cachedTeam = playerTeamCache.get(player.id);
      if (cachedTeam) player.removeTag(cachedTeam);

      player.setDynamicProperty(CONFIG.key, undefined);
      removePlayerFromRuntimeState(player.id, cachedTeam, false);
      player.nameTag = player.name;
   }

   if (teamKillObj) {
      for (let ti = 0, tLen = TEAMS.length; ti < tLen; ti++) {
         const entry = `${TEAMS[ti].color}${TEAMS[ti].name}`;
         try {
            teamKillObj.removeParticipant(entry);
         } catch (error) {
            logError('TeamActions', 'Failed to remove team kill participant', error);
         }
      }
   }
}

// ลบทุกอย่าง: ทีม tag uhc dynamic property cache stats
export function clearAllTaguhcAndDynamicProperty(executor) {
   if (executor && !executor.hasTag(CONFIG.adminTag)) return;

   refreshPlayerCaches();
   clearAllReviveRuntime();

   const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();

   clearTeamRuntimeState();

   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const player = players[pi];
      if (!player?.isValid) continue;

      const teamId = playerTeamCache.get(player.id);
      if (teamId) player.removeTag(teamId);
      if (player.hasTag('uhc')) player.removeTag('uhc');

      player.setDynamicProperty(CONFIG.key, undefined);
      removePlayerFromRuntimeState(player.id, teamId, true);
   }

   hitRegistry.clear();
   clearDeathLocations();
   allPlayersCache.length = 0;
   uhcPlayersCache.length = 0;
   allPlayersCacheIds.clear();
   playerTeamCache.clear();

   resetAnnouncer();
   resetAllStats();

   if (teamKillObj) {
      for (let ti = 0, tLen = TEAMS.length; ti < tLen; ti++) {
         const label = `${TEAMS[ti].color}${TEAMS[ti].name}`;
         try {
            teamKillObj.removeParticipant(label);
         } catch (error) {
            logError('TeamActions', 'Failed to remove team kill participant on clear', error);
         }
      }
   }

   logWarn('UHC', 'All tags, dynamic properties, and runtime states cleared.');
}

// ดึงผู้เล่นในทีม (จาก teamPlayerIndex + playerCache)
export function getPlayersByTeam(teamId) {
   if (!TEAM_LOOKUP.has(teamId)) return [];

   const ids = teamPlayerIndex.get(teamId);
   if (!ids) return [];

   const result = [];
   const idsArr = Array.from(ids);
   for (let ii = 0, iLen = idsArr.length; ii < iLen; ii++) {
      const id = idsArr[ii];
      const player = playerCache.get(id);
      if (player?.isValid) {
         result.push(player);
      } else {
         ids.delete(id);
      }
   }

   return result;
}
