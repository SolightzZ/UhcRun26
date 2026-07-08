import { system } from '@minecraft/server';
import { playerCache } from '../cache/State_Cache.js';

export const hitRegistry = new Map();
import { HIT_TIMEOUT_TICKS } from '../match/State_Game.js';

export function getRecentHitEntry(victimId) {
   if (!victimId) return null;

   const entry = hitRegistry.get(victimId);
   if (!entry) return null;

   const currentTick = system.currentTick;
   if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
      hitRegistry.delete(victimId);
      return null;
   }

   return entry;
}

export function trackHit(attacker, victim, cause) {
   if (!victim) return;
   const victimId = victim.id;
   if (!victimId) return;

   const attackerId = attacker?.id;
   const isSelfInflicted = !!attackerId && attackerId === victimId;

   let finalCause = cause;
   if (!finalCause) finalCause = 'unknown';

   const currentTick = system.currentTick;
   const existing = hitRegistry.get(victimId);
   const nextAttackerId = isSelfInflicted ? null : attackerId;

   if (existing?.tick === currentTick && existing.attackerId === nextAttackerId && existing.cause === finalCause && existing.isSelfInflicted === isSelfInflicted) {
      return;
   }

   if (!existing) {
      hitRegistry.set(victimId, {
         attackerId: nextAttackerId,
         cause: finalCause,
         damageType: finalCause,
         tick: currentTick,
         isSelfInflicted,
      });
      return;
   }

   const existingHasRecentPlayerAttacker = !!existing.attackerId && currentTick - existing.tick <= HIT_TIMEOUT_TICKS;

   if (isSelfInflicted) {
      if (!existingHasRecentPlayerAttacker) {
         existing.attackerId = null;
         existing.isSelfInflicted = true;
      }
   } else if (attackerId || !existingHasRecentPlayerAttacker) {
      existing.attackerId = attackerId;
      existing.isSelfInflicted = false;
   } else {
      existing.isSelfInflicted = false;
   }
   existing.cause = finalCause;
   existing.damageType = finalCause;
   existing.tick = currentTick;
}

export function handlerHit() {
   const currentTick = system.currentTick;
   hitRegistry.forEach((entry, victimId) => {
      if (!entry) {
         hitRegistry.delete(victimId);
         return;
      }
      if (!playerCache.has(victimId)) {
         hitRegistry.delete(victimId);
         return;
      }
      if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
         hitRegistry.delete(victimId);
      }
   });
}

export function resolveKiller(victimId) {
   const entry = getRecentHitEntry(victimId);
   if (!entry?.attackerId) return null;

   const killer = playerCache.get(entry.attackerId);
   if (!killer) return null;
   if (!killer.isValid) return null;
   return killer;
}
