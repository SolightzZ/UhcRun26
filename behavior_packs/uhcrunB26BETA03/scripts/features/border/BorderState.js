import { world } from '@minecraft/server';
import { getCachedPlayers } from '../team/TeamActions.js';

export const icons = Object.freeze({
   Sword: '',
   shield: '',
   Border: '',
   Bot: '',
   Hourglass: '',
});

export const MinecraftColor = Object.freeze({
   darkAqua: '§3',
   gray: '§7',
   green: '§a',
   red: '§c',
   yellow: '§e',
   white: '§f',
   darkBlue: '§1',
   cyan: '§b',
});

export const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];

export const borderEnd = CHECKPOINTS[CHECKPOINTS.length - 1];

export const borderColors = {
   blue: { red: 0, green: 0.54, blue: 1, alpha: 1.0 },
   red: { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 },
};

export const ticks = 20;
export const center = { x: 0, z: 0 };

const titleConfig = Object.freeze({ stayDuration: 200, fadeInDuration: 10, fadeOutDuration: 20 });
const soundConfig = Object.freeze({ volume: 0.8, pitch: 1 });

//ฟังก์ชันสร้างบริบทเกม (Game Context Factory)

export function GameContext() {
   return {
      isRunning: false,
      isDestroyed: false,
      uhcTick: 0,
      checkInterval: null,
      cachedDimension: null,
      prevShowCoordinates: false,
      borderReady: false,
      borderRadius: CHECKPOINTS[0],
      nextShrinkIndex: 1,
      nextShrinkTick: 300,
      targetRadius: null,
      wbBounds: null,
      shrinkStartTick: 0,
      shrinkDuration: 0,
      startRadius: CHECKPOINTS[0],
      currentBorderColor: borderColors.blue,
      endSeqState: 0,
      endSeqStartTick: -1,
      objective: null,
      borderDamageIndex: 0,
      cacheRetryTick: 0,
      countdownIntervalId: null,
   };
}

export const ctx = GameContext();

// แคชสำหรับการเรนเดอร์
export const renderCache = {
   aliveTeamBarCache: MinecraftColor.gray + '-',
   aliveTeamDirty: true,
   lastBorderRadius: -1,
   lastPlayerCount: -1,
   lastTargetRadius: null,
   borderMolang: null,
   scoreboardUpdateThrottle: 0,
};

// ส่งข้อความ/ชื่อเรื่อง/เสียงไปยังผู้เล่นทุกคน
export function broadcast(targetOrPayload, maybePayload) {
   let targets, payload;

   if (maybePayload !== undefined) {
      targets = targetOrPayload;
      payload = maybePayload;
   } else {
      targets = getCachedPlayers();
      payload = targetOrPayload;
   }

   if (!payload || !targets?.length) return;

   const { message, title, subtitle, sound } = payload;

   const hasMessage = typeof message === 'string';
   const hasTitle = typeof title === 'string' || typeof subtitle === 'string';
   const hasSound = typeof sound === 'string';

   if (!hasMessage && !hasTitle && !hasSound) return;

   let titleOptions;

   if (hasTitle) {
      titleOptions = {
         stayDuration: titleConfig.stayDuration,
         fadeInDuration: titleConfig.fadeInDuration,
         fadeOutDuration: titleConfig.fadeOutDuration,
         subtitle: typeof subtitle === 'string' ? subtitle : '',
      };
   }

   for (let i = 0; i < targets.length; i++) {
      const player = targets[i];
      if (!player?.isValid) continue;

      if (hasMessage) player.sendMessage(message);

      if (hasTitle) {
         player.onScreenDisplay.setTitle(typeof title === 'string' ? title : '', titleOptions);
      }

      if (hasSound) player.playSound(sound, soundConfig);
   }
}

// ส่งคืนไอคอนสถานะเกมในรูปแบบที่อ่านง่าย
export function getGameState(state) {
   if (!state.isRunning) return `${icons.Hourglass}`;
   if (state.uhcTick < 30) return `?`;
   if (!world.gameRules) return `?`;
   if (!world.gameRules.pvp) return `${icons.shield}`;
   if (state.nextShrinkIndex < CHECKPOINTS.length) return `${icons.Sword}`;
   return `?`;
}
