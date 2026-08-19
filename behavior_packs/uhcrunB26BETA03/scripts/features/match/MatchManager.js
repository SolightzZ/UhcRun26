import { Difficulty, InputPermissionCategory, system, world } from '@minecraft/server';
import { PVP_DELAY, PVP_TICK_BASE } from '../../constants/game.js';
import { ctx } from '../../features/border/BorderState.js';
import { spawnLeaderboardNPC } from '../../features/leaderboard/LeaderboardManager.js';
import { enqueueBroadcast, enqueuePlayerSetActionBar, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { dynamicToast, getOverworld, logError, setAdventure, setSurvival, SND_PLING } from '../../shared/Util.js';
import { enqueueRemoveEffect } from '../../shared/AddEffectBatcher.js';
import BlockFiller from '../block-filler/BlockFiller.js';
import BorderManager from '../border/BorderManager.js';
import { icons, MinecraftColor, renderCache, ticks } from '../border/BorderState.js';
import { refreshPlayerCaches } from '../cache/CacheManager.js';
import { allPlayersCache, uhcPlayersCache } from '../cache/State_Cache.js';
import { flushIfDirty } from '../rank/RankData.js';
import { refreshScoreboardUI } from '../stats/ScoreboardManager.js';
import { resetAnnouncer } from '../kill/KillAnnouncer.js';
import { setAliveTeamDirtyHandler } from '../team/State_Team.js';
import { getCachedPlayers, getPlayerTeam, resetStatePreserveTeams } from '../team/TeamActions.js';
import MatchTeleport from './MatchTeleport.js';
import MatchUtil from './MatchUtil.js';
import victoryManager from './MatchVictory.js';
import { setCountdownRunning, setGameRunningState } from './State_Game.js';

const PVP_TICK = PVP_TICK_BASE + PVP_DELAY;
const PVP_WARN = PVP_TICK - 20;
const PVP_CD3 = PVP_TICK - 3;
const PVP_CD2 = PVP_TICK - 2;
const PVP_CD1 = PVP_TICK - 1;
const actionBar = 25;
const actionNum = 5;

const explosionLocPool = { x: 0, y: 0, z: 0 };
const soundOptionsPlayers = { volume: 1, pitch: 1 };
const soundOptionsExplode = { volume: 0.7, pitch: 0.9 };

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

      this._borderTick = () => BorderManager.borderManagerTick();

      this._borderShrink = () => BorderManager.borderManagerTickShrink();

      this._scoreboardUpdate = () => {
         BorderManager.scoreboardUpdate(ctx.objective, uhcPlayersCache);
      };

      this._borderDamage = (player) => {
         BorderManager.borderManagerApplyDamage(player);
      };
   }

   handlePlayerLeave() {
      system.run(() => {
         if (ctx.isDestroyed) return;
         if (ctx.isRunning && allPlayersCache.length === 0) {
            this.stopGameLoop();
         }
      });
   }

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

   playerSetupHandleGameStart(players, tick) {
      if (tick > 26) return;

      switch (tick) {
         case 1:
            for (let i = 0; i < players.length; i++) {
               setAdventure(players[i]);
               players[i].inputPermissions?.setPermissionCategory(InputPermissionCategory.Movement, false);
            }
            break;

         case 2:
            enqueuePlayerSound(players, 'players', soundOptionsPlayers);
            break;

         case 26:
            for (let i = 0; i < players.length; i++) {
               players[i].inputPermissions?.setPermissionCategory(InputPermissionCategory.Movement, true);
               setSurvival(players[i]);
               enqueueRemoveEffect(players[i], 'invisibility');
               players[i].onScreenDisplay.setTitle('Good Luck, Have Fun');
               this.playerSetupSpawnParticles(players[i]);
            }

            enqueuePlayerSound(players, 'random.explode', soundOptionsExplode);
            break;
      }
   }

   playerSetupDisplayGameStart(players) {
      const tick = ctx.countdownTicks;
      if (tick < 0 || tick > actionBar) return;
      if (players.length === 0) return;

      const remaining = actionBar - tick,
         playSound = remaining === 20 || remaining === 10 || remaining <= 5;
      enqueuePlayerSetActionBar(players, this.startBars[tick]);
      if (playSound) enqueuePlayerSound(players, SND_PLING);
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
            MatchTeleport.teleportManagerTeleportTeam(undefined, () => {
               ctx.teleportComplete = true;
               ctx.countdownTicks = -1;
               world.gameRules.showCoordinates = true;
               world.gameRules.pvp = false;
               enqueueBroadcast('[UHC] Good Luck, Have Fun');
               const uhcPlayers = uhcPlayersCache;
               for (let i = 0; i < uhcPlayers.length; i++) {
                  if (uhcPlayers[i]?.isValid) MatchUtil.playerSetupAddItems(uhcPlayers[i]);
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
               message: dynamicToast(`PVP ในอีก ${MinecraftColor.red}${PVP_TICK - tick}`),
               sound: SND_PLING,
            });
            break;
         case PVP_TICK:
            world.gameRules.pvp = true;
            ctx.pvpEnabled = true;
            BorderManager.broadcast({
               message: dynamicToast('เปิดใช้งาน PVP!!', 'textures/ui/strength_effect'),
               title: icons.Sword,
               subtitle: MinecraftColor.green + 'เปิดใช้งาน PVP!!',
               sound: 'world_noti',
            });
            break;
      }
   }

   gameLoopPlayersTick(players) {
      if (!ctx.teleportComplete || !players.length || ctx.countdownTicks > 26) return;

      const tick = ctx.countdownTicks;
      const isSetupTick = tick === 1 || tick === 2 || tick === 4 || tick === 24 || tick === 26;

      const validPlayers = [];
      for (let i = 0; i < players.length; i++) {
         if (players[i]?.isValid) validPlayers.push(players[i]);
      }

      if (validPlayers.length === 0) return;
      if (isSetupTick) {
         this.playerSetupHandleGameStart(validPlayers, tick);
      }

      this.playerSetupDisplayGameStart(validPlayers);
   }

   gameLoopWorld(uhcPlayers) {
      this._borderTick();
      this._borderShrink();

      if (ctx.isRunning && ctx.uhcTick <= PVP_TICK) {
         this.gameLoopHandleWorldStart(ctx.uhcTick, uhcPlayers);
      }

      renderCache.scoreboardUpdateThrottle++;

      if (ctx.objective && ctx.uhcTick && renderCache.scoreboardUpdateThrottle) {
         this._scoreboardUpdate();
      }

      if (uhcPlayers.length > 0) {
         const DAMAGE_BATCH = Math.max(1, Math.ceil(uhcPlayers.length / 5));
         for (let i = 0; i < DAMAGE_BATCH; i++) {
            if (ctx.borderDamageIndex >= uhcPlayers.length) ctx.borderDamageIndex = 0;
            this._borderDamage(uhcPlayers[ctx.borderDamageIndex]);
            ctx.borderDamageIndex++;
         }
      }

      BorderManager.particleRendererTick(uhcPlayers);
   }

   #gameLoopGuard() {
      return !ctx.isRunning || ctx.isDestroyed;
   }

   gameLoopRun() {
      ctx.checkInterval = system.runInterval(() => {
         try {
            if (this.#gameLoopGuard()) return;
            ctx.uhcTick++;

            if (ctx.uhcTick % 60 === 0 && ctx.teleportComplete) {
               victoryManager.victoryManagerCheck();
            }

            if (ctx.teleportComplete) {
               ctx.countdownTicks++;
            }

            const uhcPlayers = uhcPlayersCache;
            this.gameLoopWorld(uhcPlayers);

            if (ctx.countdownTicks <= 26) {
               this.gameLoopPlayersTick(uhcPlayers);
            }
         } catch (error) {
            logError('UHC', 'Game loop error at tick ' + ctx.uhcTick, error);
         }
      }, ticks);
   }

   markAliveTeamDirty() {
      ctx.aliveTeamDirty = true;
   }

   #clearUhcCountdown() {
      if (ctx.countdownIntervalId !== null) {
         system.clearRun(ctx.countdownIntervalId);
         ctx.countdownIntervalId = null;
      }
      setCountdownRunning(false);
   }

   startGameUhc() {
      if (ctx.isRunning) return;

      this.#clearUhcCountdown();
      this.stopGameLoop();
      this.#initMatchContext();
      this.#initTeleport();
      this.#initGameRunning();
      this.#initBorderSystems();
      this.#initScoreboard();
      this.setupPlayers();
      this.gameLoopRun();
   }

   #initMatchContext() {
      ctx.isDestroyed = false;
      ctx.isRunning = true;
      ctx.prevShowCoordinates = world.gameRules.showCoordinates;
      ctx.uhcTick = 0;
      ctx.teleportComplete = false;
      ctx.countdownTicks = -1;
      ctx.cachedDimension = getOverworld();
      ctx.pvpEnabled = false;
   }

   #initTeleport() {
      MatchTeleport.safeYCache.clear();
      MatchTeleport.abortAllTeleportQueues();
   }

   #initGameRunning() {
      setGameRunningState(true);
   }

   #initBorderSystems() {
      BorderManager.init();
      BorderManager.resetBorderState();
      BorderManager.resetUiState();
   }

   #initScoreboard() {
      BorderManager.scoreboardInit();
   }

   setupPlayers() {
      const players = getCachedPlayers();
      if (!players.length) return;
      this._batchSetupPlayers(players, 0, 6);
   }

   _batchSetupPlayers(players, index, batchSize) {
      for (let i = 0; i < batchSize && index < players.length; i++, index++) {
         const player = players[index];
         if (!player?.isValid) continue;
         MatchUtil.playerSetupClearItemsKeepCompass(player);
         MatchUtil.playerSetupApplyStartState(player);
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
      this.#clearUhcCountdown();

      flushIfDirty();

      this.cleanupGameState();
      this.resetPlayerStates();
      this.restoreWorldSettings(prevShowCoordinates);
   }

   cleanupGameState() {
      MatchTeleport.abortAllTeleportQueues();
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
         MatchUtil.playerSetupApplyEndState(players[index]);
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

      this.#clearUhcCountdown();
      this.stopGameLoop();
      this.cleanupResetState();
      this.resetAllPlayers();
      this.restoreWorldDefaults(prevShowCoordinates);
      spawnLeaderboardNPC();
   }

   cleanupResetState() {
      MatchTeleport.safeYCache.clear();
      BlockFiller.fillReset();
      BorderManager.resetContext(ctx);
      BorderManager.endSequenceReset();
      MatchTeleport.abortAllTeleportQueues();

      setGameRunningState(false);
      BorderManager.scoreboardClear();
      resetStatePreserveTeams();
      refreshScoreboardUI();
   }

   resetAllPlayers() {
      const players = getCachedPlayers();
      if (!players.length) return;
      this._batchResetAllPlayers(players, 0, 6);
   }

   _batchResetAllPlayers(players, index, batchSize) {
      for (let i = 0; i < batchSize && index < players.length; i++, index++) {
         const p = players[index];
         if (!p?.isValid) continue;

         MatchUtil.playerSetupClearEffects(p);
         MatchUtil.playerSetupApplyEndState(p);
         MatchUtil.playerSetupClearItemsKeepCompass(p);
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
