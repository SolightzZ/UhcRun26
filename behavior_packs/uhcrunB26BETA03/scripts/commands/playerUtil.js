import { InputPermissionCategory, ItemStack, system, world } from '@minecraft/server';
import { SPAWN_CONFIG } from '../constants/game.js';
import { getPlayerInventoryContainer } from '../features/cache/CacheManager.js';
import { allPlayersCache } from '../features/cache/State_Cache.js';
import { enqueueAddEffect } from '../shared/AddEffectBatcher.js';
import { enqueuePlayerSound } from '../shared/MessageBatcher.js';
import { COMPASS_ITEM, logError, setAdventure } from '../shared/Util.js';

let SPAWN_DIMENSION = null;

function getSpawnDimension() {
   if (!SPAWN_DIMENSION) SPAWN_DIMENSION = world.getDimension(SPAWN_CONFIG.dimension);
   return SPAWN_DIMENSION;
}

const SETUP_RESET_EFFECTS = Object.freeze([
   { type: 'regeneration', duration: 500 },
   { type: 'resistance', duration: 500 },
   { type: 'saturation', duration: 500 },
]);

export function batch({ step, budget = 1, onDone }) {
   const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
   let i = 0;

   if (players.length === 0) {
      if (typeof onDone === 'function') onDone();
      return;
   }

   const run = system.runInterval(() => {
      const batchPlayers = players.slice(i, i + budget);
      i += batchPlayers.length;

      for (let bi = 0, bLen = batchPlayers.length; bi < bLen; bi++) {
         const player = batchPlayers[bi];
         if (!player?.isValid) continue;
         try {
            step(player);
         } catch (error) {
            logError('batch', 'step error for player', error);
         }
      }

      if (i >= players.length) {
         system.clearRun(run);
         if (typeof onDone === 'function') onDone();
      }
   }, 2);
}

export function cmd(commandString) {
   try {
      getSpawnDimension().runCommand(commandString);
   } catch (error) {
      logError('cmd', 'Failed: ' + commandString, error);
   }
}

function setItemPlayer(player) {
   const container = getPlayerInventoryContainer(player);
   if (!container) return;
   container.clearAll();
   container.setItem(0, new ItemStack(COMPASS_ITEM, 1));
}

function applyEffects(player, effects = []) {
   for (let ei = 0, eLen = effects.length; ei < eLen; ei++) {
      const { type, duration, amp = 0 } = effects[ei];
      enqueueAddEffect(player, type, duration, {
         amplifier: amp,
         showParticles: false,
      });
   }
}

function setPlayerSpawn(player) {
   if (!player?.isValid) return;
   try {
      enqueuePlayerSound(player, 'spawn');
      setAdventure(player);
      player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
      player.teleport({ x: SPAWN_CONFIG.x, y: SPAWN_CONFIG.y, z: SPAWN_CONFIG.z }, { dimension: getSpawnDimension() });
   } catch (error) {
      logError('Command', 'Failed to set player spawn for ' + player.name, error);
   }
}

export function setupOrReset(player) {
   setItemPlayer(player);
   setPlayerSpawn(player);
   applyEffects(player, SETUP_RESET_EFFECTS);
}

export function end(player) {
   setItemPlayer(player);
   applyEffects(player, [{ type: 'regeneration', duration: 255 }]);
   player.addLevels(-10000);
   player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
}
