import { system, world } from '@minecraft/server';
import { MENU_MSG, SPAWN_CONFIG } from '../../constants/game.js';
import { enqueuePlayerMessage, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { createLoc, freeLoc, getSafeDimension, logError } from '../../shared/Util.js';
import { allPlayersCache, uhcPlayersCache } from '../cache/State_Cache.js';

export function AdminTeleport(source, target) {
   if (!source?.isValid || !target?.isValid) return;

   const loc = target.location;
   const rot = target.getRotation();
   if (!loc || !rot) return;

   try {
      const dim = getSafeDimension(target);
      const yawRad = (rot.y * Math.PI) / 180;
      const tLoc = createLoc(loc.x + Math.sin(yawRad) * 5, loc.y, loc.z - Math.cos(yawRad) * 5);
      source.teleport(tLoc, { dimension: dim });
      freeLoc(tLoc);
   } catch (error) {
      logError('Teleport', 'AdminTeleport failed', error);
   }
}

export function playerTeleport(source, target) {
   if (!source?.isValid) return;
   if (!target?.isValid) {
      enqueuePlayerMessage(source, MENU_MSG.targetOffline);
      return;
   }

   const loc = target.location;
   const rot = target.getRotation();

   try {
      const yawRad = (rot.y * Math.PI) / 180;
      const pLoc = createLoc(loc.x + Math.sin(yawRad) * 5, loc.y, loc.z - Math.cos(yawRad) * 5);
      source.teleport(pLoc, { dimension: target.dimension });
      freeLoc(pLoc);
      enqueuePlayerSound(source, 'teleport.ender_pearl');
   } catch (error) {
      logError('Teleport', 'playerTeleport failed', error);
   }
}

let _spawnDim = null;

export function teleportToSpawn(player) {
   if (!_spawnDim) _spawnDim = world.getDimension(SPAWN_CONFIG.dimension);
   if (!player?.isValid) return;

   const tx = SPAWN_CONFIG.x + Math.floor(Math.random() * 5) - 2;
   const ty = SPAWN_CONFIG.y - 7;
   const tz = SPAWN_CONFIG.z + Math.floor(Math.random() * 5) - 2;
   try {
      const sLoc = createLoc(tx, ty, tz);
      player.teleport(sLoc, { dimension: _spawnDim });
      freeLoc(sLoc);
   } catch (error) {
      logError('Teleport', 'teleportToSpawn failed', error);
      return;
   }

   system.runTimeout(() => {
      if (!player?.isValid) return;
      enqueuePlayerSound(player, 'random.enderchestopen', { volume: 0.8, pitch: 0.95 });

      try {
         _spawnDim.spawnParticle('so:light2', { x: tx, y: ty + 5, z: tz });
      } catch {
         // ชังก์ยังไม่ได้ถูกโหลด — การแสดงผลพาร์ติเคิลไม่ใช่ส่วนวิกฤต
      }
   }, 5);
}

export const getOtherUhcPlayers = (excludeId) => uhcPlayersCache.filter((p) => p.id !== excludeId);

export function teleportGetAllPlayers(player) {
   const players = allPlayersCache;
   const result = [];
   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const p = players[pi];
      if (!p?.isValid) continue;
      if (player && p.id === player.id) continue;
      result.push(p);
   }
   return result;
}
