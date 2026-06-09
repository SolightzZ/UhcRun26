//จัดการ NPC leaderboard: render, spawn, update
import { system } from '@minecraft/server';
import { getOverworld } from '../plugin/Util.js';
import { refreshPlayerCaches } from './CacheManager.js';
import { NPCS, NPC_QUERY_OPTIONS, UI, resetCache } from './LeaderboardConfig.js';
import { getStats, getTeamText } from './LeaderboardData.js';
import { getDeathsText, getPlayerText } from './LeaderboardFormat.js';

//แยก NPC ตาม tag (teams, players, deaths)
function collectNpcsByTag(allNpcs) {
   const teamNpcs = [];
   const playerNpcs = [];
   const deathNpcs = [];

   for (const npcEntity of allNpcs) {
      if (!npcEntity?.isValid) continue;
      if (npcEntity.hasTag('lb:teams')) teamNpcs.push(npcEntity);
      else if (npcEntity.hasTag('lb:players')) playerNpcs.push(npcEntity);
      else if (npcEntity.hasTag('lb:deaths')) deathNpcs.push(npcEntity);
   }

   return { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs };
}

//อัปเดตข้อความบน NPC leaderboard ทั้ง 3 ตัว
export function renderBoard() {
   const overworldDimension = getOverworld();
   let allNpcs = [];

   try {
      allNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
   } catch (error) {
      console.error('[DEBUG] Error getting NPCs:', error);
      return;
   }

   if (!allNpcs.length) return;

   const { pNpcs: playerNpcs, tNpcs: teamNpcs, dNpcs: deathNpcs } = collectNpcsByTag(allNpcs);

   if (!teamNpcs.length && !playerNpcs.length && !deathNpcs.length) return;

   const playerStats = getStats();

   if (teamNpcs.length) {
      const teamText = getTeamText();
      updateNpcText(teamNpcs, `${UI.HEAD}${teamText}${UI.FOOT}`);
   }

   if (playerNpcs.length) {
      const playerText = getPlayerText(playerStats);
      updateNpcText(playerNpcs, `${UI.HEAD}${playerText}${UI.FOOT}`);
   }

   if (deathNpcs.length) {
      const deathsText = getDeathsText(playerStats);
      updateNpcText(deathNpcs, `${UI.HEAD}${deathsText}${UI.FOOT}`);
   }
}

function updateNpcText(npcList, displayText) {
   for (const npcEntity of npcList) {
      if (!npcEntity?.isValid) continue;
      if (typeof npcEntity.nameTag !== 'string') continue;
      if (npcEntity.nameTag === displayText) continue;
      npcEntity.nameTag = displayText;
   }
}

//สร้าง NPC 3 ตัวที่ตำแหน่งกำหนด พร้อม tag
function spawnLeaderboardNPCNow() {
   try {
      const overworldDimension = getOverworld();

      const existingNpcs = overworldDimension.getEntities(NPC_QUERY_OPTIONS);
      for (const npc of existingNpcs) {
         try {
            npc.remove();
         } catch (error) {
            console.error('[LeaderboardNPC] Failed to remove existing NPC:', error);
         }
      }

      NPCS.forEach((npcConfig, ni) => {
         try {
            const newNpcEntity = overworldDimension.spawnEntity('minecraft:npc', {
               x: npcConfig.x,
               y: npcConfig.y,
               z: npcConfig.z,
            });

            if (ni === 0) {
               newNpcEntity.nameTag = '§b§lTOP TEAMS (KILLS)';
               newNpcEntity.addTag('lb:teams');
            } else if (ni === 1) {
               newNpcEntity.nameTag = '§e§lTOP PLAYERS (KILLS)';
               newNpcEntity.addTag('lb:players');
            } else if (ni === 2) {
               newNpcEntity.nameTag = '§c§lTOP PLAYERS (DEATHS)';
               newNpcEntity.addTag('lb:deaths');
            }
         } catch (error) {
            console.error('[LeaderboardNPC] Failed to spawn NPC:', error);
         }
      });

      updateLeaderboard();
   } catch (error) {
      console.error('[LeaderboardNPC] Failed to spawn leaderboard NPC:', error);
   }
}

//รีเซ็ต cache และ render board ใหม่
export function updateLeaderboard() {
   system.runTimeout(() => {
      resetCache();
      refreshPlayerCaches();
      renderBoard();
   }, 40);
}

export function spawnLeaderboardNPC() {
   system.runTimeout(spawnLeaderboardNPCNow, 20);
}

system.run(renderBoard);

//ป้องกันไม่ให้ผู้เล่นโต้ตอบกับ NPC
export function HandlerCancelNPC(eventData) {
   try {
      const { target } = eventData;
      if (target?.typeId === 'minecraft:npc') {
         eventData.cancel = true;
      }
   } catch (error) {
      console.error('[LeaderboardNPC] HandlerCancelNPC error:', error);
   }
}
