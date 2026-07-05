import { system, world } from '@minecraft/server';
import { logError } from './Util.js';

const messageQueue = [];
let flushTask = null;
const seenMessages = new Set();
const MAX_BATCH_SIZE = 10;

export function enqueueBroadcast(msg) {
   if (!msg || typeof msg !== 'string') return;
   if (msg.length === 0) return;
   if (seenMessages.has(msg)) return;
   seenMessages.add(msg);
   messageQueue.push(msg);
   scheduleFlush();
}

function scheduleFlush() {
   if (flushTask !== null) return;
   flushTask = system.run(doFlush);
}

function doFlush() {
   flushTask = null;
   if (messageQueue.length === 0) {
      seenMessages.clear();
      return;
   }

   const batch = messageQueue.splice(0, MAX_BATCH_SIZE);
   seenMessages.clear();

   try {
      for (let i = 0; i < batch.length; i++) {
         world.sendMessage(batch[i]);
      }
   } catch (error) {
      logError('MessageBatcher', 'Failed to flush message batch', error);
   }

   if (messageQueue.length > 0) scheduleFlush();
}

// Per-player broadcast (message + title + sound)
const playerOpQueue = [];
let playerFlushTask = null;
const MAX_PLAYER_OPS = 8;

export function enqueuePlayerBroadcast(targets, payload) {
   if (!payload || !targets || targets.length === 0) return;
   const { message, title, subtitle, sound, soundOptions } = payload;
   if (!message && !title && !subtitle && !sound) return;

   const dedupKey = `${message ?? ''}|${title ?? ''}|${subtitle ?? ''}|${sound ?? ''}`;
   if (seenPlayerOps.has(dedupKey)) return;
   seenPlayerOps.add(dedupKey);

   playerOpQueue.push({ targets, message, title, subtitle, sound, soundOptions });
   schedulePlayerFlush();
}

const seenPlayerOps = new Set();
const titleConfig = Object.freeze({ stayDuration: 200, fadeInDuration: 10, fadeOutDuration: 20 });
const soundConfig = Object.freeze({ volume: 0.8, pitch: 1 });

function schedulePlayerFlush() {
   if (playerFlushTask !== null) return;
   playerFlushTask = system.run(doPlayerFlush);
}

function doPlayerFlush() {
   playerFlushTask = null;
   const ops = playerOpQueue.splice(0, MAX_PLAYER_OPS);
   seenPlayerOps.clear();

   for (let oi = 0; oi < ops.length; oi++) {
      const { targets, message, title, subtitle, sound, soundOptions } = ops[oi];
      const hasMessage = typeof message === 'string';
      const hasTitle = typeof title === 'string' || typeof subtitle === 'string';
      const hasSound = typeof sound === 'string';
      if (!hasMessage && !hasTitle && !hasSound) continue;

      let titleOptions;
      if (hasTitle) {
         titleOptions = {
            stayDuration: titleConfig.stayDuration,
            fadeInDuration: titleConfig.fadeInDuration,
            fadeOutDuration: titleConfig.fadeOutDuration,
            subtitle: typeof subtitle === 'string' ? subtitle : '',
         };
      }

      const finalSoundOptions = soundOptions ?? soundConfig;

      // strip location property — แต่ละ player จะได้ยินเสียงที่ตำแหน่งของตัวเอง
      const { location: _loc, ...soundOptsNoLoc } = finalSoundOptions;
      const playerSoundOpts = _loc !== undefined ? soundOptsNoLoc : finalSoundOptions;

      const tLen = targets.length;
      for (let ti = 0; ti < tLen; ti++) {
         const player = targets[ti];
         if (!player?.isValid) continue;
         try {
            if (hasMessage) player.sendMessage(message);
            if (hasTitle) player.onScreenDisplay.setTitle(typeof title === 'string' ? title : '', titleOptions);
            if (hasSound) player.playSound(sound, playerSoundOpts);
         } catch (error) {
            logError('PlayerBcast', 'Per-player broadcast failed', error);
         }
      }
   }

   if (playerOpQueue.length > 0) schedulePlayerFlush();
}

// Per-player action bars
const actionBarQueue = [];
let abFlushTask = null;
const MAX_AB_OPS = 8;
const seenActionBars = new Set();

export function enqueuePlayerActionBar(targets, message) {
   if (!message || !targets || targets.length === 0) return;
   if (seenActionBars.has(message)) return;
   seenActionBars.add(message);

   actionBarQueue.push({ targets, message });
   scheduleABFlush();
}

function scheduleABFlush() {
   if (abFlushTask !== null) return;
   abFlushTask = system.run(doABFlush);
}

function doABFlush() {
   abFlushTask = null;
   const ops = actionBarQueue.splice(0, MAX_AB_OPS);
   seenActionBars.clear();

   for (let oi = 0; oi < ops.length; oi++) {
      const { targets, message } = ops[oi];
      const tLen = targets.length;
      for (let ti = 0; ti < tLen; ti++) {
         const player = targets[ti];
         if (!player?.isValid) continue;
         try {
            player.onScreenDisplay.setActionBar(message);
         } catch (error) {
            logError('PlayerAB', 'Action bar set failed', error);
         }
      }
   }

   if (actionBarQueue.length > 0) scheduleABFlush();
}

// Multiplayer
function resolveTargets(player) {
   if (Array.isArray(player)) {
      return player.filter((p) => p?.isValid);
   }
   return player?.isValid ? [player] : [];
}

export function enqueuePlayerMessage(player, msg) {
   if (!msg) return;
   const targets = resolveTargets(player);
   if (targets.length === 0) return;
   enqueuePlayerBroadcast(targets, { message: msg });
}

export function enqueuePlayerSound(player, sound, soundOptions) {
   if (!sound) return;
   const targets = resolveTargets(player);
   if (targets.length === 0) return;
   enqueuePlayerBroadcast(targets, { sound, soundOptions });
}

export function enqueuePlayerTitle(player, title, subtitle) {
   if (!title && !subtitle) return;
   const targets = resolveTargets(player);
   if (targets.length === 0) return;
   enqueuePlayerBroadcast(targets, { title, subtitle });
}

export function enqueuePlayerSetActionBar(player, msg) {
   if (!msg) return;
   const targets = resolveTargets(player);
   if (targets.length === 0) return;
   enqueuePlayerActionBar(targets, msg);
}
