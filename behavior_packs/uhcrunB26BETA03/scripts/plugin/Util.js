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

export function isAliveAndUhc(player) {
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

export function applyKnockbackXZ(
   entity,
   nx,
   nz,
   horizontal,
   vertical,
   maxHorizontal = KB.maxHorizontal,
) {
   if (!entity?.isValid) return;
   try {
      entity.applyKnockback(
         { x: clamp(nx * horizontal, maxHorizontal), z: clamp(nz * horizontal, maxHorizontal) },
         vertical,
      );
   } catch (error) {
      console.error('[Util] Failed to apply knockback:', error);
   }
}

export function applyKnockbackFromDelta(
   entity,
   fromX,
   fromZ,
   toX,
   toZ,
   horizontal,
   vertical,
   maxHorizontal = KB.maxHorizontal,
) {
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
      console.error('[Util] isValidEntity check failed:', error);
      return false;
   }
}

// เรียกใช้งานตัวจัดการปลั๊กอิน/ตัวจัดการอื่นๆ แยกกัน เพื่อป้องกันไม่ให้ความล้มเหลวเพียงครั้งเดียวส่งผลกระทบต่อส่วนอื่นๆ
export function runEventHandlers(tag, handlers, event) {
   for (let i = 0; i < handlers.length; i++) {
      try {
         handlers[i](event);
      } catch (error) {
         console.error(`[${tag}] handler ${i} error:`, error?.message ?? error);
      }
   }
}

export function getPlayerInventoryContainer(player) {
   if (!player?.isValid) return null;
   try {
      return player.getComponent('minecraft:inventory')?.container ?? null;
   } catch (error) {
      console.error('[Util] Failed to get inventory:', error);
      return null;
   }
}

// Dynamic Toast
function padTo(text, total = 100) {
   const safe = text.length > total ? text.slice(0, total) : text;
   return safe + '\t'.repeat(total - safe.length);
}

export function dynamicToast(msg = '', icon = '', bg = 'textures/ui/greyBorder') {
   return '§N§O§T§I§F§I§C§A§T§I§O§N' + padTo(msg, 500) + padTo(icon, 100) + padTo(bg, 100);
}
