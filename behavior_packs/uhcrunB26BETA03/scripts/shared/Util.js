import { GameMode, world } from '@minecraft/server';

export const COMPASS_ITEM = 'minecraft:compass';
export const SND_BASS = 'note.bassattack';
export const SND_PLING = 'note.pling';
export const TEX_CANCEL = 'textures/ui/wysiwyg_reset.png';
export const TEX_HEART = 'textures/ui/heart_new';
export const TEX_BARRIER = 'textures/blocks/barrier';

let _overworld = null;
export function getOverworld() {
   return _overworld ?? (_overworld = world.getDimension('overworld'));
}
export function getSafeDimension(player) {
   return player.dimension ?? getOverworld();
}

export const KB = Object.freeze({
   horizontal: 0.18,
   vertical: 0.32,
   maxHorizontal: 1.2,
});


export function clamp(v, max) {
   return v > max ? max : v < -max ? -max : v;
}

export function normalizeXZ(x, z) {
   const len = Math.hypot(x, z) || 1;
   return { nx: x / len, nz: z / len, len };
}

export function applyKnockbackXZ(entity, nx, nz, horizontal, vertical, maxHorizontal = KB.maxHorizontal) {
   if (!entity?.isValid) return;
   try {
      entity.applyKnockback({ x: clamp(nx * horizontal, maxHorizontal), z: clamp(nz * horizontal, maxHorizontal) }, vertical);
   } catch (error) {
      logError('Util', 'Failed to apply knockback', error);
   }
}

export function applyKnockbackFromDelta(entity, fromX, fromZ, toX, toZ, horizontal, vertical, maxHorizontal = KB.maxHorizontal) {
   const { nx, nz } = normalizeXZ(toX - fromX, toZ - fromZ);
   applyKnockbackXZ(entity, nx, nz, horizontal, vertical, maxHorizontal);
}

export function randomInt(min, max) {
   return (Math.random() * (max - min + 1) + min) | 0;
}

export function isValidEntity(entity) {
   try {
      return !!entity && entity.isValid;
   } catch (error) {
      logError('Util', 'isValidEntity check failed', error);
      return false;
   }
}

export function runEventHandlers(tag, handlers, event) {
   for (let i = 0; i < handlers.length; i++) {
      try {
         handlers[i](event);
      } catch (error) {
         logError(tag, 'handler ' + i + ' error', error);
      }
   }
}

const TOAST_PREFIX = '§N§O§T§I§F§I§C§A§T§I§O§N';
let _pad500 = null;
let _pad100 = null;

function padTo(text, total = 100) {
   const safe = text.length > total ? text.slice(0, total) : text;
   const rem = total - safe.length;
   if (total === 500) return safe + (_pad500 ?? (_pad500 = '\t'.repeat(500))).substring(0, rem);
   if (total === 100) return safe + (_pad100 ?? (_pad100 = '\t'.repeat(100))).substring(0, rem);
   return safe + '\t'.repeat(rem);
}

// toast hack: uses §N§O§T§I§F§I§C§A§T§I§O§N to trigger vanilla toast UI
export function dynamicToast(msg = '', icon = '', bg = 'textures/ui/greyBorder') {
   return TOAST_PREFIX + padTo(msg, 500) + padTo(icon, 100) + padTo(bg, 100);
}

const locPool = [];
export function createLoc(x = 0, y = 0, z = 0) {
   let loc = locPool.pop();
   if (!loc) loc = {};
   loc.x = x;
   loc.y = y;
   loc.z = z;
   return loc;
}
export function freeLoc(loc) {
   if (loc) locPool.push(loc);
}

export function createItemQueryOptions(x, y, z, maxDistance = 16) {
   return {
      type: 'minecraft:item',
      location: { x, y, z },
      maxDistance,
   };
}

export function logError(tag, message, error) {
   const errStr = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error);
   console.error(`[${tag}] ${message}:`, errStr);
}

export function logWarn(tag, message) {
   console.warn(`[${tag}] ${message}`);
}

export function setSurvival(player) {
   try {
      player.setGameMode(GameMode.survival);
   } catch (error) {
      logError('Util', 'setSurvival failed', error);
   }
}

export function setAdventure(player) {
   try {
      player.setGameMode(GameMode.adventure);
   } catch (error) {
      logError('Util', 'setAdventure failed', error);
   }
}

export function setSpectator(player) {
   try {
      player.setGameMode(GameMode.spectator);
   } catch (error) {
      logError('Util', 'setSpectator failed', error);
   }
}
