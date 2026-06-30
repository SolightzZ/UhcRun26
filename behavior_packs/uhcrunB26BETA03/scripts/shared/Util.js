import { GameMode, world } from '@minecraft/server';

export const COMPASS_ITEM = 'minecraft:compass';
export const SND_BASS = 'note.bassattack';
export const SND_PLING = 'note.pling';
export const TEX_CANCEL = 'textures/ui/cancel';
export const TEX_HEART = 'textures/ui/heart_new';
export const TEX_BARRIER = 'textures/blocks/barrier';

export function setSpectator(player) {
   player?.setGameMode(GameMode.Spectator);
}

export function setAdventure(player) {
   player?.setGameMode(GameMode.Adventure);
}

export function setSurvival(player) {
   player?.setGameMode(GameMode.Survival);
}

export function getOverworld() {
   return world.getDimension('overworld');
}

export function getSafeDimension(player) {
   return player.dimension ?? getOverworld();
}

export function isValidAndUhc(player) {
   return player?.isValid && player.hasTag('uhc');
}

// Knockback
export const KB = Object.freeze({
   horizontal: 0.18,
   vertical: 0.32,
   maxHorizontal: 1.2,
});

export function clamp(v, max) {
   return v > max ? max : v < -max ? -max : v;
}

// ทิศทางการเคลื่อนที่ของหน่วยบนแกน XZ จากจุดสามเหลี่ยม (เช่น ผู้โจมตี → ผู้ถูกโจมตี)
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

// เรียกใช้งานตัวจัดการปลั๊กอิน/ตัวจัดการอื่นๆ แยกกัน เพื่อป้องกันไม่ให้ความล้มเหลวเพียงครั้งเดียวส่งผลกระทบต่อส่วนอื่นๆ
export function runEventHandlers(tag, handlers, event) {
   for (let i = 0; i < handlers.length; i++) {
      try {
         handlers[i](event);
      } catch (error) {
         logError(tag, 'handler ' + i + ' error', error);
      }
   }
}


// Dynamic Toast
function padTo(text, total = 100) {
   const safe = text.length > total ? text.slice(0, total) : text;
   return safe + '\t'.repeat(total - safe.length);
}

// toast hack: ใช้ §N§O§T§I§F§I§C§A§T§I§O§N trigger vanilla toast UI
export function dynamicToast(msg = '', icon = '', bg = 'textures/ui/greyBorder') {
   return '§N§O§T§I§F§I§C§A§T§I§O§N' + padTo(msg, 500) + padTo(icon, 100) + padTo(bg, 100);
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

// สร้างตัวเลือกแบบสอบถามเอนทิตีใหม่สำหรับสุญญากาศสินค้า การโทรแต่ละครั้งจะหลีกเลี่ยงการแชร์สถานะที่ไม่แน่นอน
export function createItemQueryOptions(x, y, z, maxDistance = 16) {
   return {
      type: 'minecraft:item',
      location: { x, y, z },
      maxDistance,
   };
}



export function logError(tag, message, error) {
   console.error(`[${tag}] ${message}:`, error instanceof Error ? error.message : String(error));
}

export function logWarn(tag, message) {
   console.warn(`[${tag}] ${message}`);
}
