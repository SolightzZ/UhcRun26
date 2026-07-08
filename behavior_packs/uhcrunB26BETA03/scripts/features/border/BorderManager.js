import { dynamicToast, TEX_BARRIER } from '../../shared/Util.js';
import BlockFiller from '../block-filler/BlockFiller.js';
import { END_SEQUENCE_STATE } from '../block-filler/BlockFillerConstants.js';
import { uhcPlayersCache } from '../cache/State_Cache.js';
import BorderGuard from './BorderGuard.js';
import BorderParticle from './BorderParticle.js';
import BorderScoreboard from './BorderScoreboard.js';
import BorderShrink from './BorderShrink.js';
import { borderColors, broadcast, CHECKPOINTS, ctx, GameContext, MinecraftColor, renderCache } from './BorderState.js';
import BorderWarningDamage from './BorderWarningDamage.js';

class BorderManager {
   init() {
      BlockFiller.setIsEndgameHandler(() => ctx.nextShrinkIndex >= CHECKPOINTS.length);
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
      BorderShrink.borderManagerSetRadius(CHECKPOINTS[0]);
      ctx.borderReady = true;
      BorderShrink.borderManagerSyncGeometry();
   }

   resetUiState() {
      renderCache.aliveTeamDirty = true;
      renderCache.aliveTeamBarCache = MinecraftColor.gray + '-';
      renderCache.lastBorderRadius = -1;
      renderCache.lastPlayerCount = -1;
      renderCache.lastTargetRadius = null;
      BorderScoreboard.clearCache();
      BorderWarningDamage.clearCache();
   }

   borderManagerTick() {
      if (ctx.nextShrinkIndex >= CHECKPOINTS.length) {
         this.endSequenceTick();
         return;
      }

      if (ctx.uhcTick === ctx.nextShrinkTick - 30) BorderShrink.borderManagerBroadcastWarning();
      if (ctx.uhcTick >= ctx.nextShrinkTick) BorderShrink.borderManagerApplyShrink();
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
         broadcast(uhcPlayersCache, {
            message: dynamicToast('Border ถึงวงสุดท้ายแล้ว!', TEX_BARRIER),
            sound: 'world_noti',
         });
         return;
      }

      if (!BlockFiller.shouldAdvanceEndSequence(ctx.uhcTick, ctx.endSeqState, ctx.endSeqStartTick, BlockFiller.fillHasPendingWork())) return;

      const step = BlockFiller.getEndSequenceStep(ctx.endSeqState);
      if (!step) return;

      ctx.endSeqState = step.nextState;
      ctx.endSeqStartTick = ctx.uhcTick;

      const players = uhcPlayersCache;
      broadcast(players, {
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

   particleRendererTick(players) {
      return BorderParticle.particleRendererTick(players);
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

   broadcast(players, options) {
      return broadcast(players, options);
   }

   scoreboardInit() {
      return BorderScoreboard.scoreboardInit();
   }
   scoreboardClear() {
      return BorderScoreboard.scoreboardClear();
   }
   scoreboardUpdate(obj, uhcPlayers) {
      return BorderScoreboard.scoreboardUpdate(obj, uhcPlayers);
   }
   borderManagerApplyDamage(player) {
      return BorderWarningDamage.borderManagerApplyDamage(player);
   }
   getTeamsCached() {
      return BorderShrink.getTeamsCached();
   }
   borderManagerSyncGeometry() {
      return BorderShrink.borderManagerSyncGeometry();
   }
   borderManagerIsOutside(x, z) {
      return BorderShrink.borderManagerIsOutside(x, z);
   }
   borderManagerTickShrink() {
      return BorderShrink.borderManagerTickShrink();
   }

   handlePlayerBreakBlock(ev) {
      return BorderGuard.handlePlayerBreakBlock(ev);
   }
   handlePlayerInteractWithEntity(ev) {
      return BorderGuard.handlePlayerInteractWithEntity(ev);
   }
   handlePlayerInteractWithBlock(ev) {
      return BorderGuard.handlePlayerInteractWithBlock(ev);
   }
   handlePlayerPlaceBlock(ev) {
      return BorderGuard.handlePlayerPlaceBlock(ev);
   }
   isUhcPlayer(player) {
      return BorderGuard.isUhcPlayer(player);
   }
}

export default new BorderManager();
