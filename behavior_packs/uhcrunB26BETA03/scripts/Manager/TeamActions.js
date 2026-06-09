//จัดการทีม: join, leave, set, clear พร้อม GUI และ nametag
import { system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { dynamicToast, SND_BASS, TEX_CANCEL } from '../plugin/Util.js';
import {
   clearTeamRuntimeState,
   refreshPlayerCaches,
   removePlayerFromRuntimeState,
} from './CacheManager.js';
import { updateSidebar } from './ScoreboardManager.js';
import {
   allPlayersCache,
   allPlayersCacheIds,
   hitRegistry,
   playerCache,
   playerTeamCache,
   uhcPlayersCache,
} from './State_Cache.js';
import { isGameRunning, teamKillObj } from './State_Game.js';
import { clearAllReviveRuntime } from './State_Revive.js';
import {
   aliveTeamDirtyHandler,
   deathLocation,
   playerStats,
   TEAM_INDEX_MAP,
   TEAM_LOOKUP,
   teamCounts,
   teamPlayerIndex,
} from './State_Team.js';
import { createLoc } from './State_Util.js';
import { resetAllStats, resetAnnouncer, scheduleSaveStats } from './StatsManager.js';
import { CONFIG, TEAM_MENU, TEAMS } from './UtilTeamManager.js';

const dirtyNametagIds = new Set();
let nametagFlushTask = null;

// อัปเดตบางฟิลด์ของ playerStats โดยไม่ลบของเก่า
function patchPlayerStats(playerId, patch) {
   const ps = playerStats.get(playerId) ?? { kills: 0, deaths: 0 };
   if (patch.name !== undefined) ps.name = patch.name;
   if (patch.teamId !== undefined) ps.teamId = patch.teamId;
   playerStats.set(playerId, ps);
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
function getTotalTeamPlayers() {
   let total = 0;
   const countValues = Array.from(teamCounts.values());
   for (let ci = 0, cLen = countValues.length; ci < cLen; ci++) {
      total += countValues[ci];
   }
   return total;
}

// ตรวจสอบว่ายังมีที่ว่างให้เข้าร่วมทีมไหม
function canJoinTeam(newTeamId) {
   const totalBefore = getTotalTeamPlayers();
   return totalBefore < CONFIG.maxTotalPlayers;
}

// จำนวนผู้เล่นในทีม
function getTeamPlayerCount(teamId) {
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
      teamPlayerIndex.get(oldTeamId)?.delete(player.id);
   }

   if (teamId) {
      player.setDynamicProperty(CONFIG.key, teamId);
      playerTeamCache.set(player.id, teamId);
      if (shouldTrack) {
         teamPlayerIndex.get(teamId)?.add(player.id);
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
      teamCounts.set(oldTeam, oldCount > 0 ? oldCount - 1 : 0);
   }

   if (shouldTrack) {
      const newCount = teamCounts.get(newTeamId) ?? 0;
      teamCounts.set(newTeamId, newCount + 1);
   }

   setTeam(player, newTeamId);

   if (shouldTrack) {
      if (oldTeam) updateSidebar(oldTeam);
      updateSidebar(newTeamId);
   }
}

// ให้ผู้เล่นออกจากทีม
export function leaveTeam(player) {
   const oldTeam = getPlayerTeam(player);
   if (!oldTeam) return;

   const shouldTrack = !isGameRunning || player?.hasTag('uhc');

   if (shouldTrack) {
      const current = teamCounts.get(oldTeam) ?? 0;
      teamCounts.set(oldTeam, current > 0 ? current - 1 : 0);
   }
   setTeam(player, null);
   if (shouldTrack) {
      updateSidebar(oldTeam);
   }
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
            console.error('[TeamActions] Failed to remove team kill participant:', error);
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
   deathLocation.clear();
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
            console.error('[TeamActions] Failed to remove team kill participant on clear:', error);
         }
      }
   }

   console.warn('[UHC] All tags, dynamic properties, and runtime states cleared.');
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

// แสดง GUI เลือกทีม
export function openTeamMenu(player) {
   if (isGameRunning && player.hasTag('uhc') && !player.hasTag(CONFIG.adminTag)) {
      player.sendMessage(dynamicToast(TEAM_MENU.cannotChangeMidGame, TEX_CANCEL));
      player.playSound(SND_BASS);
      return;
   }
   const form = new ActionFormData();
   form.title(CONFIG.title + TEAM_MENU.titleSuffix);
   const currentTeamId = getPlayerTeam(player);
   const currentTeam = currentTeamId ? TEAM_LOOKUP.get(currentTeamId) : null;
   let teamDisplay = TEAM_MENU.unknownTeam;
   if (currentTeam) {
      teamDisplay = `${currentTeam.color}${currentTeam.name}`;
   }
   const totalNow = getTotalTeamPlayers();
   form.body(
      `§f${player.name}: ${teamDisplay}\n§7Total: §f${totalNow}§7/§f${CONFIG.maxTotalPlayers}`,
   );
   const teamsLen = TEAMS.length;
   for (let ti = 0; ti < teamsLen; ti++) {
      const team = TEAMS[ti];
      const count = getTeamPlayerCount(team.id);
      form.button(`${team.color}${team.name} §7(${count})`, team.icon);
   }
   form.button(TEAM_MENU.leave, 'textures/ui/permissions_visitor_hand');
   form.button(TEAM_MENU.refresh, 'textures/ui/refresh_light');
   form.button(TEAM_MENU.close, TEX_CANCEL);
   form.show(player).then((res) => {
      if (!res || res.canceled) return;
      const selection = res.selection;

      if (selection < teamsLen) {
         const selectedTeam = TEAMS[selection];
         if (currentTeamId === selectedTeam.id) {
            player.playSound(SND_BASS);
            player.sendMessage(dynamicToast(TEAM_MENU.alreadyOnTeam, selectedTeam.icon));
            system.run(() => openTeamMenu(player));
            return;
         }
         if (!currentTeamId && !canJoinTeam(selectedTeam.id)) {
            player.playSound(SND_BASS);
            player.sendMessage(
               dynamicToast(TEAM_MENU.serverFullShort(CONFIG.maxTotalPlayers), TEX_CANCEL),
            );
            system.run(() => openTeamMenu(player));
            return;
         }
         joinTeam(player, selectedTeam.id);
         try {
            const pLoc = createLoc(player.location.x, player.location.y + 1, player.location.z);               player.dimension.spawnParticle(selectedTeam.id, pLoc);
         } catch (error) {
            console.error('[TeamActions] Failed to spawn team particle:', error);
         }
         player.playSound('random.orb', { pitch: 0.6, volume: 0.4 });
         player.sendMessage(
            dynamicToast(`Joined ${selectedTeam.color}${selectedTeam.name}`, selectedTeam.icon),
         );
         system.run(() => openTeamMenu(player));
         return;
      }

      const actionIndex = selection - teamsLen;
      switch (actionIndex) {
         case 0: {
            if (!currentTeamId || !currentTeam) {
               player.playSound(SND_BASS);
               player.sendMessage(dynamicToast(TEAM_MENU.noTeam, TEX_CANCEL));
               system.run(() => openTeamMenu(player));
               return;
            }
            leaveTeam(player);
            player.playSound('random.break');
            player.sendMessage(
               dynamicToast(
                  `§c§oLeft from ${currentTeam.color}${currentTeam.name}`,
                  'textures/ui/permissions_visitor_hand',
               ),
            );
            system.run(() => openTeamMenu(player));
            return;
         }
         case 1:
            system.run(() => openTeamMenu(player));
            return;
         case 2:
            return;
      }
   });
}
