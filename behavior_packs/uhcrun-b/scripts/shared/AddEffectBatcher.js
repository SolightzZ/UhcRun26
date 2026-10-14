import { system } from '@minecraft/server';
import { logError } from './Util.js';

const MAX_BATCH_SIZE = 10;

const effectQueue = [];
let flushTask = null;

const removeQueue = [];
let removeFlushTask = null;

function scheduleFlush() {
   if (flushTask !== null) return;
   flushTask = system.run(doFlush);
}

function scheduleRemoveFlush() {
   if (removeFlushTask !== null) return;
   removeFlushTask = system.run(doRemoveFlush);
}

export function enqueueAddEffect(player, effectType, duration, options = {}) {
   if (!player?.isValid) return;
   if (!effectType || typeof effectType !== 'string') return;
   if (typeof duration !== 'number' || duration <= 0) return;

   effectQueue.push({ player, effectType, duration, options });
   scheduleFlush();
}

export function enqueueAddEffectToPlayers(players, effectType, duration, options = {}) {
   for (let i = 0; i < players.length; i++) {
      enqueueAddEffect(players[i], effectType, duration, options);
   }
}

export function enqueueRemoveEffect(player, effectType) {
   if (!player?.isValid) return;
   if (!effectType || typeof effectType !== 'string') return;

   removeQueue.push({ player, effectType });
   scheduleRemoveFlush();
}

function doFlush() {
   flushTask = null;
   if (effectQueue.length === 0) return;

   const batch = effectQueue.splice(0, MAX_BATCH_SIZE);

   for (let i = 0; i < batch.length; i++) {
      const { player, effectType, duration, options } = batch[i];
      if (!player?.isValid) continue;
      try {
         player.addEffect(effectType, duration, options);
      } catch (error) {
         logError('EffectBatcher', `addEffect(${effectType}) failed`, error);
      }
   }

   if (effectQueue.length > 0) scheduleFlush();
}

function doRemoveFlush() {
   removeFlushTask = null;
   if (removeQueue.length === 0) return;

   const batch = removeQueue.splice(0, MAX_BATCH_SIZE);

   for (let i = 0; i < batch.length; i++) {
      const { player, effectType } = batch[i];
      if (!player?.isValid) continue;
      try {
         player.removeEffect(effectType);
      } catch (error) {
         logError('EffectBatcher', `removeEffect(${effectType}) failed`, error);
      }
   }

   if (removeQueue.length > 0) scheduleRemoveFlush();
}
