//ฟังก์ชัน teleport สำหรับ admin และผู้เล่นทั่วไป
import { system, world } from '@minecraft/server';
import { getSafeDimension } from '../plugin/Util.js';
import { uhcPlayersCache } from './State_Cache.js';
import { createLoc } from './State_Util.js';
import { MENU_MSG, SPAWN_CONFIG } from './UtilTeamManager.js';

//เทเลพอร์ต admin ไปหาผู้เล่นเป้าหมาย
export function AdminTeleport(source, target) {
   if (!source?.isValid || !target?.isValid) return;

   const loc = target.location;

   if (!loc) return;

   try {
      const dim = getSafeDimension(target);
      source.teleport(createLoc(loc.x, loc.y, loc.z), { dimension: dim });
   } catch (error) {
      console.error('[Teleport] AdminTeleport failed:', error);
   }
}

//TPA ปกติสำหรับผู้เล่นทั่วไป
export function playerTeleport(source, target) {
   if (!source?.isValid) return;
   if (!target?.isValid) {
      source.sendMessage(MENU_MSG.targetOffline);
      return;
   }

   const loc = target.location;

   try {
      source.teleport(createLoc(loc.x, loc.y, loc.z), { dimension: target.dimension });
      source.playSound('teleport.ender_pearl');
   } catch (error) {
      console.error('[Teleport] playerTeleport failed:', error);
   }
}

//เทเลพอร์ตไป world spawn พร้อม particle
export function teleportToSpawn(player) {
   if (!player?.isValid) return;

   const tx = SPAWN_CONFIG.x + Math.floor(Math.random() * 5) - 2;
   const ty = SPAWN_CONFIG.y - 7;
   const tz = SPAWN_CONFIG.z + Math.floor(Math.random() * 5) - 2;
   try {
      const dim = world.getDimension(SPAWN_CONFIG.dimension);
      player.teleport(createLoc(tx, ty, tz), { dimension: dim });
   } catch (error) {
      console.error('[Teleport] teleportToSpawn failed:', error);
      return;
   }

   system.runTimeout(() => {
      if (!player?.isValid) return;
      player.playSound('random.enderchestopen', { volume: 0.9, pitch: 0.95 });
      try {
         dim.spawnParticle('so:light2', { x: tx, y: ty + 5, z: tz });
      } catch (error) {
         console.error('[Teleport] Failed to spawn particle at spawn:', error);
      }
   }, 5);
}

//รายชื่อผู้เล่น UHC ทั้งหมดยกเว้นคนที่ส่งมา
export const getOtherUhcPlayers = (excludeId) => uhcPlayersCache.filter((p) => p.id !== excludeId);

//รายชื่อผู้เล่นทั้งหมดในเซิฟเวอร์ยกเว้นคนที่ส่งมา
export function teleportGetAllPlayers(player) {
   const players = world.getPlayers();
   const result = [];
   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const p = players[pi];
      if (!p?.isValid) continue;
      if (player && p.id === player.id) continue;
      result.push(p);
   }
   return result;
}
