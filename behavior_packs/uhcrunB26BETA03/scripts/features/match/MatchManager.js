import { Difficulty, InputPermissionCategory, system, world } from '@minecraft/server';
import { spawnLeaderboardNPC } from '../../features/leaderboard/LeaderboardManager.js';
import { wrapTick } from '../../shared/profiler/index.js';
import { dynamicToast, getOverworld, logError, setAdventure, setSurvival, SND_PLING } from '../../shared/Util.js';
import { PVP_DELAY, PVP_TICK_BASE } from '../../constants/game.js';
import BlockFiller from '../block-filler/BlockFiller.js';
import BorderManager, { ctx, icons, MinecraftColor, renderCache, ticks } from '../border/BorderManager.js';
import { refreshPlayerCaches } from '../cache/CacheManager.js';
import { allPlayersCache, uhcPlayersCache } from '../cache/State_Cache.js';
import { flushIfDirty } from '../rank/RankData.js';
import { refreshScoreboardUI } from '../stats/ScoreboardManager.js';
import { resetAnnouncer } from '../stats/StatsManager.js';
import { setAliveTeamDirtyHandler } from '../team/State_Team.js';
import { clearAllTaguhcAndDynamicProperty, getPlayerTeam } from '../team/TeamActions.js';
import tlm from './MatchTeleport.js';
import utilUmm from './MatchUtil.js';
import vic from './MatchVictory.js';
import { setGameRunningState } from './State_Game.js';

const PVP_TICK = PVP_TICK_BASE + PVP_DELAY;
const PVP_WARN = PVP_TICK - 20;
const PVP_CD3 = PVP_TICK - 3;
const PVP_CD2 = PVP_TICK - 2;
const PVP_CD1 = PVP_TICK - 1;
const actionBar = 25;
const actionNum = 5;

const explosionLocPool = { x: 0, y: 0, z: 0 };
const soundOptionsStart = { volume: 0.8, pitch: 1 };
const soundOptionsPlayers = { volume: 1, pitch: 1 };
const soundOptionsExplode = { volume: 0.7, pitch: 0.9 };

function getAllPlayers() {
   return allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
}

class UhcMatchManager {
   startBars;

   constructor() {
      const prefix = '§fGame Start §l»§r ';
      const bars = new Array(actionBar + 1);
      for (let tick = 0; tick <= actionBar; tick++) {
         const remaining = actionBar - tick;
         const filled = ((tick * actionNum) / actionBar) | 0;
         const empty = actionNum - filled;
         bars[tick] = prefix + MinecraftColor.darkAqua + '▌'.repeat(filled) + MinecraftColor.gray + '▌'.repeat(empty) + MinecraftColor.white + ` ${remaining}`;
      }
      this.startBars = bars;

      setAliveTeamDirtyHandler(() => this.markAliveTeamDirty());
   }

   // stop game if server empty
   handlePlayerLeave() {
      system.run(() => {
         if (ctx.isDestroyed) return;
         if (ctx.isRunning && allPlayersCache.length === 0) {
            this.stopGameLoop();
         }
      });
   }

   // restart game loop if players return
   handlePlayerSpawn(event) {
      if (ctx.isDestroyed) return;
      if (ctx.isRunning && ctx.checkInterval === null) {
         this.gameLoopRun();
      }
   }

   getUhcPlayersCached() {
      const players = uhcPlayersCache;
      if (players.length > 0) {
         ctx.cacheRetryTick = 0;
         return players;
      }

      if (ctx.uhcTick < ctx.cacheRetryTick + 5) return players;
      ctx.cacheRetryTick = ctx.uhcTick;

      refreshPlayerCaches();
      return uhcPlayersCache;
   }

   playerSetupSpawnParticles(player) {
      if (!player?.isValid || !getPlayerTeam(player)) return;
      const { x, y, z } = player.location;
      if (!player.dimension) return;
      const particleY = y + 2.5;
      if (particleY > 320 || particleY < -64) return;
      try {
         explosionLocPool.x = x;
         explosionLocPool.y = particleY;
         explosionLocPool.z = z;
         player.dimension.spawnParticle('minecraft:huge_explosion_emitter', explosionLocPool);
      } catch (error) {
         logError('UHC', 'Failed to spawn explosion particle', error);
      }
   }

   playerSetupHandleGameStart(player, tick) {
      if (tick > 26) return;

      const input = player.inputPermissions;

      switch (tick) {
         case 1:
            setAdventure(player);
            input?.setPermissionCategory(InputPermissionCategory.Movement, false);
            break;

         case 2:
            player.playSound('start', soundOptionsStart);
            break;

         case 4:
            player.playSound('players', soundOptionsPlayers);
            break;

         case 24:
            player.playSound('startPlayer', soundOptionsStart);
            break;

         case 26:
            input?.setPermissionCategory(InputPermissionCategory.Movement, true);
            setSurvival(player);
            player.removeEffect('invisibility');
            player.onScreenDisplay.setTitle('Good Luck, Have Fun');
            player.playSound('random.explode', soundOptionsExplode);
            this.playerSetupSpawnParticles(player);
            break;
      }
   }

   playerSetupDisplayGameStart(player) {
      const tick = ctx.countdownTicks;
      if (tick < 0 || tick > actionBar) return;
      if (!player?.isValid) return;
      const remaining = actionBar - tick,
         playSound = remaining === 20 || remaining === 10 || remaining <= 5;
      player.onScreenDisplay.setActionBar(this.startBars[tick]);
      if (playSound) player.playSound(SND_PLING, { volume: 1, pitch: 1 });
   }

   stopGameLoop() {
      if (ctx.checkInterval === null) return;
      system.clearRun(ctx.checkInterval);
      ctx.checkInterval = null;
      ctx.isDestroyed = true;
   }

   gameLoopHandleWorldStart(tick, players) {
      if (tick > PVP_TICK + 1 || !players.length) return;

      switch (tick) {
         case 1:
            tlm.teleportManagerTeleportTeam(undefined, () => {
               ctx.teleportComplete = true;
               ctx.countdownTicks = -1;
               world.gameRules.showCoordinates = true;
               world.gameRules.pvp = false;
               world.sendMessage('[UHC] Good Luck, Have Fun');
               const uhcPlayers = uhcPlayersCache;
               for (let i = 0; i < uhcPlayers.length; i++) {
                  if (uhcPlayers[i]?.isValid) utilUmm.playerSetupAddItems(uhcPlayers[i]);
               }
            });
            break;
         case PVP_WARN:
            BorderManager.broadcast({
               message: dynamicToast(`PVP starts in ${MinecraftColor.red}${PVP_DELAY} ${MinecraftColor.white}s`, 'textures/ui/icon_multiplayer'),
               sound: 'noti',
            });
            break;
         case PVP_CD3:
         case PVP_CD2:
         case PVP_CD1:
            BorderManager.broadcast({
               message: dynamicToast(`PVP in ${MinecraftColor.red}${PVP_TICK - tick}`),
               sound: SND_PLING,
            });
            break;
         case PVP_TICK:
            world.gameRules.pvp = true;
            BorderManager.broadcast({
               message: dynamicToast('PVP enabled!!', 'textures/ui/strength_effect'),
               title: icons.Sword,
               subtitle: MinecraftColor.green + 'PVP enabled!!',
               sound: 'world_noti',
            });
            break;
      }
   }

   gameLoopPlayersTick(players) {
      if (!ctx.teleportComplete || !players.length || ctx.countdownTicks > 26) return;

      const tick = ctx.countdownTicks;
      const isSetupTick = tick === 1 || tick === 2 || tick === 4 || tick === 24 || tick === 26;

      if (isSetupTick) {
         for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p?.isValid) continue;
            this.playerSetupHandleGameStart(p, tick);
         }
      }

      for (let i = 0; i < players.length; i++) {
         const p = players[i];
         if (!p?.isValid) continue;
         this.playerSetupDisplayGameStart(p);
      }
   }

   gameLoopWorld(uhcPlayers) {
      wrapTick('borderTick', () => {
         BorderManager.borderManagerTick();
      })();

      wrapTick('borderShrink', () => {
         BorderManager.borderManagerTickShrink();
      })();

      if (ctx.isRunning && ctx.uhcTick <= PVP_TICK) {
         this.gameLoopHandleWorldStart(ctx.uhcTick, uhcPlayers);
      }

      renderCache.scoreboardUpdateThrottle++;
      if (ctx.objective && ctx.uhcTick && renderCache.scoreboardUpdateThrottle % 2 === 0) {
         wrapTick('scoreboardUpdate', () => {
            BorderManager.scoreboardUpdate(ctx.objective, uhcPlayers);
         })();
      }

      if (uhcPlayers.length > 0) {
         const DAMAGE_BATCH = Math.max(1, Math.ceil(uhcPlayers.length / 5));
         const _applyDamage = wrapTick('borderDamage', (player) => {
            BorderManager.borderManagerApplyDamage(player);
         });

         for (let i = 0; i < DAMAGE_BATCH; i++) {
            if (ctx.borderDamageIndex >= uhcPlayers.length) ctx.borderDamageIndex = 0;
            _applyDamage(uhcPlayers[ctx.borderDamageIndex]);
            ctx.borderDamageIndex++;
         }
      }

      BorderManager.particleRendererTick(uhcPlayers);
   }

   gameLoopRun() {
      ctx.checkInterval = system.runInterval(
         wrapTick('gameLoop', () => {
            try {
               if (!ctx.isRunning || ctx.isDestroyed) return;
               ctx.uhcTick++;

               if (ctx.teleportComplete) {
                  ctx.countdownTicks++;
               }

               const uhcPlayers = uhcPlayersCache;
               wrapTick('gameLoopWorld', () => {
                  this.gameLoopWorld(uhcPlayers);
               })();

               if (ctx.countdownTicks <= 26) {
                  wrapTick('playersTick', () => {
                     this.gameLoopPlayersTick(uhcPlayers);
                  })();
               }
            } catch (error) {
               logError('UHC', 'Game loop error at tick ' + ctx.uhcTick, error);
            }
         }),
         ticks,
      );
   }

   markAliveTeamDirty() {
      ctx.aliveTeamDirty = true;
   }

   startGameUhc() {
      if (ctx.isRunning) return;

      vic.resetCountdownRunning();
      this.stopGameLoop();
      this.initializeGameState();
      this.setupPlayers();
      this.gameLoopRun();
   }

   initializeGameState() {
      ctx.isDestroyed = false;
      ctx.isRunning = true;
      ctx.prevShowCoordinates = world.gameRules.showCoordinates;
      ctx.uhcTick = 0;
      ctx.teleportComplete = false;
      ctx.countdownTicks = -1;
      try {
         ctx.cachedDimension = getOverworld();
      } catch (error) {
         logError('UHC', 'Failed to get overworld dimension', error);
         ctx.cachedDimension = null;
      }

      tlm.safeYCache.clear();
      tlm.abortAllTeleportQueues();

      setGameRunningState(true);
      BorderManager.init();
      BorderManager.resetBorderState();
      BorderManager.resetUiState();
      BorderManager.scoreboardInit();
   }

   setupPlayers() {
      const players = getAllPlayers();
      if (!players.length) return;
      this._batchSetupPlayers(players, 0, 6);
   }

   _batchSetupPlayers(players, index, batchSize) {
      for (let i = 0; i < batchSize && index < players.length; i++, index++) {
         const player = players[index];
         if (!player?.isValid) continue;
         utilUmm.playerSetupClearItemsKeepCompass(player);
         utilUmm.playerSetupApplyStartState(player);
      }
      if (index < players.length) {
         system.runTimeout(() => this._batchSetupPlayers(players, index, batchSize), 1);
      } else {
         refreshPlayerCaches();
      }
   }

   endGameUhc() {
      world.setDifficulty(Difficulty.Peaceful);
      const prevShowCoordinates = ctx.prevShowCoordinates;

      this.stopGameLoop();
      vic.resetCountdownRunning();

      // flush rank data before cleanup
      flushIfDirty();

      this.cleanupGameState();
      this.resetPlayerStates();
      this.restoreWorldSettings(prevShowCoordinates);
   }

   cleanupGameState() {
      tlm.abortAllTeleportQueues();
      BlockFiller.fillReset();
      BorderManager.endSequenceReset();
      BorderManager.scoreboardClear();
      resetAnnouncer();
      setGameRunningState(false);
      refreshScoreboardUI();
      BorderManager.resetContext(ctx);
   }

   resetPlayerStates() {
      const players = uhcPlayersCache;
      if (!players.length) return;
      this._batchResetPlayerStates(players, 0, 10);
   }

   _batchResetPlayerStates(players, index, batchSize) {
      for (let i = 0; i < batchSize && index < players.length; i++, index++) {
         utilUmm.playerSetupApplyEndState(players[index]);
      }
      if (index < players.length) {
         system.runTimeout(() => this._batchResetPlayerStates(players, index, batchSize), 1);
      }
   }

   restoreWorldSettings(prevShowCoordinates) {
      world.gameRules.showCoordinates = prevShowCoordinates;
      BorderManager.borderManagerSyncGeometry();
   }

   resetGameUhc() {
      world.setDifficulty(Difficulty.Peaceful);
      const prevShowCoordinates = ctx.prevShowCoordinates;

      vic.resetCountdownRunning();
      this.stopGameLoop();
      this.cleanupResetState();
      this.resetAllPlayers();
      this.restoreWorldDefaults(prevShowCoordinates);
      spawnLeaderboardNPC();
   }

   cleanupResetState() {
      tlm.safeYCache.clear();
      BlockFiller.fillReset();
      BorderManager.resetContext(ctx);
      BorderManager.endSequenceReset();
      tlm.abortAllTeleportQueues();

      setGameRunningState(false);
      BorderManager.scoreboardClear();
      clearAllTaguhcAndDynamicProperty();
      refreshScoreboardUI();
   }

   resetAllPlayers() {
      const players = getAllPlayers();
      if (!players.length) return;
      this._batchResetAllPlayers(players, 0, 6);
   }

   _batchResetAllPlayers(players, index, batchSize) {
      for (let i = 0; i < batchSize && index < players.length; i++, index++) {
         const p = players[index];
         if (!p?.isValid) continue;

         utilUmm.playerSetupClearEffects(p);
         utilUmm.playerSetupApplyEndState(p);
         utilUmm.playerSetupClearItemsKeepCompass(p);
      }
      if (index < players.length) {
         system.runTimeout(() => this._batchResetAllPlayers(players, index, batchSize), 1);
      }
   }

   restoreWorldDefaults(prevShowCoordinates) {
      BorderManager.borderManagerSyncGeometry();
      world.gameRules.pvp = false;
      world.gameRules.showCoordinates = prevShowCoordinates;
   }
}

export default new UhcMatchManager();
