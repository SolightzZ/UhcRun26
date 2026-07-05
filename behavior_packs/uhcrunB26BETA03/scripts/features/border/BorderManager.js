import { world } from '@minecraft/server';
import { dynamicToast, TEX_BARRIER } from '../../shared/Util.js';
import bf from '../block-filler/BlockFiller.js';
import { END_SEQUENCE_STATE } from '../block-filler/BlockFillerConstants.js';
import { uhcPlayersCache } from '../cache/State_Cache.js';
import { getCachedPlayers } from '../team/TeamActions.js';
import borderEvents from './BorderGuard.js';
import particleInstance from './BorderParticle.js';
import scoreboardInstance from './BorderScoreboard.js';
import shrinkInstance from './BorderShrink.js';
import warningDamageInstance from './BorderWarningDamage.js';

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

// Game state — mutated by BorderManager and sub-systems
function GameContext() {
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

// Change-detection caches — only read/written by renderers (Scoreboard, Particle)
export const renderCache = {
   aliveTeamBarCache: MinecraftColor.gray + '-',
   aliveTeamDirty: true,
   lastBorderRadius: -1,
   lastPlayerCount: -1,
   lastTargetRadius: null,
   borderMolang: null,
   scoreboardUpdateThrottle: 0,
};

const titleConfig = Object.freeze({ stayDuration: 200, fadeInDuration: 10, fadeOutDuration: 20 });
const soundConfig = Object.freeze({ volume: 0.8, pitch: 1 });

class BorderManager {
   init() {
      bf.setIsEndgameHandler(() => ctx.nextShrinkIndex >= CHECKPOINTS.length);
   }

   resetBorderState() {
      ctx.nextShrinkIndex = 1;
      ctx.nextShrinkTick = 300;
      ctx.targetRadius = null;
      ctx.wbBounds = null;
      ctx.borderReady = false;
      ctx.shrinkStartTick = 0;
      ctx.shrinkDuration = 0;
      ctx.startRadius = CHECKPOINTS[0];
      ctx.currentBorderColor = borderColors.blue;
      this.endSequenceReset();
      shrinkInstance.borderManagerSetRadius(CHECKPOINTS[0]);
      ctx.borderReady = true;
      shrinkInstance.borderManagerSyncGeometry();
   }

   resetUiState() {
      renderCache.aliveTeamDirty = true;
      renderCache.aliveTeamBarCache = MinecraftColor.gray + '-';
      renderCache.lastBorderRadius = -1;
      renderCache.lastPlayerCount = -1;
      renderCache.lastTargetRadius = null;
      scoreboardInstance.clearCache();
      warningDamageInstance.clearCache();
   }

   borderManagerTick() {
      if (ctx.nextShrinkIndex >= CHECKPOINTS.length) {
         this.endSequenceTick();
         return;
      }

      if (ctx.uhcTick === ctx.nextShrinkTick - 30) shrinkInstance.borderManagerBroadcastWarning();
      if (ctx.uhcTick >= ctx.nextShrinkTick) shrinkInstance.borderManagerApplyShrink();
   }

   endSequenceReset() {
      ctx.endSeqState = 0;
      ctx.endSeqStartTick = -1;
   }

   endSequenceTick() {
      if (ctx.endSeqState === END_SEQUENCE_STATE.COMPLETED) return;
      if (ctx.targetRadius !== null) return;

      if (ctx.endSeqStartTick === -1) {
         ctx.endSeqStartTick = ctx.uhcTick;
         this.broadcast(uhcPlayersCache, {
            message: dynamicToast('Border ถึงวงสุดท้ายแล้ว!', TEX_BARRIER),
            sound: 'world_noti',
         });
         return;
      }

      if (!bf.shouldAdvanceEndSequence(ctx.uhcTick, ctx.endSeqState, ctx.endSeqStartTick, bf.fillHasPendingWork())) return;

      const step = bf.getEndSequenceStep(ctx.endSeqState);
      if (!step) return;

      ctx.endSeqState = step.nextState;
      ctx.endSeqStartTick = ctx.uhcTick;

      const players = uhcPlayersCache;
      this.broadcast(players, {
         message: dynamicToast(step.message, step.icon),
         sound: 'world_noti',
      });

      for (let i = 0, len = players.length; i < len; i++) {
         const player = players[i];
         if (player?.isValid && typeof step.run === 'function') {
            step.run(player);
         }
      }
   }

   broadcast(targetOrPayload, maybePayload) {
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

   particleRendererTick(players) {
      return particleInstance.particleRendererTick(players);
   }

   resetContext(target) {
      if (!target) return;

      const fresh = GameContext();
      const keys = Object.keys(fresh);

      for (let i = 0; i < keys.length; i++) {
         target[keys[i]] = fresh[keys[i]];
      }

      renderCache.aliveTeamBarCache = MinecraftColor.gray + '-';
      renderCache.aliveTeamDirty = true;
      renderCache.lastBorderRadius = -1;
      renderCache.lastPlayerCount = -1;
      renderCache.lastTargetRadius = null;
      renderCache.borderMolang = null;
      renderCache.scoreboardUpdateThrottle = 0;
   }

   scoreboardInit() {
      return scoreboardInstance.scoreboardInit();
   }
   scoreboardClear() {
      return scoreboardInstance.scoreboardClear();
   }
   scoreboardUpdate(obj, uhcPlayers) {
      return scoreboardInstance.scoreboardUpdate(obj, uhcPlayers);
   }
   borderManagerApplyDamage(player) {
      return warningDamageInstance.borderManagerApplyDamage(player);
   }
   getTeamsCached() {
      return shrinkInstance.getTeamsCached();
   }
   borderManagerSyncGeometry() {
      return shrinkInstance.borderManagerSyncGeometry();
   }
   borderManagerIsOutside(x, z) {
      return shrinkInstance.borderManagerIsOutside(x, z);
   }
   borderManagerTickShrink() {
      return shrinkInstance.borderManagerTickShrink();
   }

   handlePlayerBreakBlock(ev) {
      return borderEvents.handlePlayerBreakBlock(ev);
   }
   handlePlayerInteractWithEntity(ev) {
      return borderEvents.handlePlayerInteractWithEntity(ev);
   }
   handlePlayerInteractWithBlock(ev) {
      return borderEvents.handlePlayerInteractWithBlock(ev);
   }
   handlePlayerPlaceBlock(ev) {
      return borderEvents.handlePlayerPlaceBlock(ev);
   }
   isUhcPlayer(player) {
      return borderEvents.isUhcPlayer(player);
   }

   // Return computed game state string so scoreboard doesn't read ctx directly
   getGameState() {
      if (!ctx.isRunning) return `${icons.Hourglass}`;
      if (ctx.uhcTick < 30) return `?`;
      if (!world.gameRules) return `?`;
      if (!world.gameRules.pvp) return `${icons.shield}`;
      if (ctx.nextShrinkIndex < CHECKPOINTS.length) return `${icons.Sword}`;
      return `?`;
   }
}

export default new BorderManager();
