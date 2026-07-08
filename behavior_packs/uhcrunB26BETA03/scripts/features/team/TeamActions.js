import { system, world } from '@minecraft/server';
import { CONFIG, TEAM_MENU, TEAMS } from '../../constants/game.js';
import { enqueuePlayerMessage, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { dynamicToast, logError, logWarn, SND_BASS, TEX_CANCEL } from '../../shared/Util.js';
import { clearTeamRuntimeState, refreshPlayerCaches, removePlayerFromRuntimeState } from '../cache/CacheManager.js';
import { allPlayersCache, playerCache, playerTeamCache, uhcPlayerIds, uhcPlayersCache } from '../cache/State_Cache.js';
import { hitRegistry } from '../kill/HitTracker.js';
import { isGameRunning, teamKillObj } from '../match/State_Game.js';
import { clearAllReviveRuntime } from '../revive/State_Revive.js';
import { resetAllStats, scheduleSaveStats } from '../stats/StatsManager.js';
import { resetAnnouncer } from '../kill/KillAnnouncer.js';
import {
   addToTeamIndex,
   aliveTeamDirtyHandler,
   clearDeathLocations,
   getTeamCount,
   playerStats,
   removeFromTeamIndex,
   setPlayerStats,
   TEAM_INDEX_MAP,
   TEAM_LOOKUP,
   teamPlayerIndex,
} from './State_Team.js';

const dirtyNametagIds = new Set();
let nametagFlushTask = null;

function patchPlayerStats(playerId, patch) {
   const ps = playerStats.get(playerId) ?? { kills: 0, deaths: 0 };
   if (patch.name !== undefined) ps.name = patch.name;
   if (patch.teamId !== undefined) ps.teamId = patch.teamId;
   setPlayerStats(playerId, ps);
   return ps;
}

function formatTeamNametag(player, teamId) {
   const teamInfo = TEAM_LOOKUP.get(teamId);
   if (!teamInfo) return player.name;
   const teamIndex = (TEAM_INDEX_MAP.get(teamId) ?? -1) + 1;
   return `${teamInfo.color}[${teamIndex}]${player.name}`;
}

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

function markNametagDirty(playerId) {
   if (!playerId) return;
   dirtyNametagIds.add(playerId);
   if (nametagFlushTask !== null) return;
   nametagFlushTask = system.runTimeout(() => {
      nametagFlushTask = null;
      flushNametagUpdates();
   }, 1);
}

export function getTotalTeamPlayers() {
   let total = 0;
   teamPlayerIndex.forEach((set) => {
      total += set.size;
   });
   return total;
}

function canJoinTeam(newTeamId) {
   const totalBefore = getTotalTeamPlayers();
   return totalBefore < CONFIG.maxTotalPlayers;
}

export function getTeamPlayerCount(teamId) {
   return getTeamCount(teamId);
}

export function getCachedPlayers() {
   return allPlayersCache;
}

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

export function setTeam(player, teamId, options = {}) {
   if (!player?.id) return;
   const scheduleSave = options.scheduleSave !== false;
   const oldTeamId = playerTeamCache.get(player.id) ?? null;
   if (oldTeamId === teamId) return;
   const shouldTrack = !isGameRunning || uhcPlayerIds.has(player.id);

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

export function joinTeam(player, newTeamId) {
   if (!TEAM_LOOKUP.has(newTeamId)) return;

   const oldTeam = getPlayerTeam(player);
   if (oldTeam === newTeamId) return;

   const shouldTrack = !isGameRunning || uhcPlayerIds.has(player.id);

   if (shouldTrack && !oldTeam && !canJoinTeam(newTeamId)) {
      enqueuePlayerMessage(player, dynamicToast(TEAM_MENU.serverFull(CONFIG.maxTotalPlayers), TEX_CANCEL));
      enqueuePlayerSound(player, SND_BASS);
      return;
   }

   setTeam(player, newTeamId);
}

export function leaveTeam(player) {
   const oldTeam = getPlayerTeam(player);
   if (!oldTeam) return;

   setTeam(player, null);
}

export function clearAllTeams(executor) {
   if (executor && !executor.hasTag(CONFIG.adminTag)) return;
   refreshPlayerCaches();
   clearAllReviveRuntime();

   const players = getCachedPlayers();

   clearTeamRuntimeState();

   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const player = players[pi];
      if (!player?.isValid) continue;

      const cachedTeam = playerTeamCache.get(player.id);
      if (cachedTeam) player.removeTag(cachedTeam);

      player.setDynamicProperty(CONFIG.key, undefined);
      removePlayerFromRuntimeState(player.id, cachedTeam);
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

export function resetStatePreserveTeams() {
   if (nametagFlushTask !== null) {
      system.clearRun(nametagFlushTask);
      nametagFlushTask = null;
   }
   dirtyNametagIds.clear();

   clearAllReviveRuntime();

   const prevPlayers = allPlayersCache;
   for (let pi = 0, pLen = prevPlayers.length; pi < pLen; pi++) {
      const p = prevPlayers[pi];
      if (!p?.isValid) continue;
      p.nameTag = p.name;
   }

   refreshPlayerCaches();

   hitRegistry.clear();
   clearDeathLocations();
   resetAnnouncer();
   resetAllStats();

   if (teamKillObj) {
      for (let ti = 0, tLen = TEAMS.length; ti < tLen; ti++) {
         const label = `${TEAMS[ti].color}${TEAMS[ti].name}`;
         try {
            teamKillObj.removeParticipant(label);
         } catch (error) {
            logError('TeamActions', 'Failed to remove team kill participant on reset', error);
         }
      }
   }
}

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
