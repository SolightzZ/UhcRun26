import { Difficulty, InputPermissionCategory, system, world } from '@minecraft/server';

import {
   clearAllPlayerNametags,
   clearAllTaguhcAndDynamicProperty,
   getPlayerTeam,
   getUhcPlayers,
   refreshPlayerCaches,
   refreshScoreboardUI,
   registerAliveTeamDirtyHandler,
   resetAnnouncer,
   setGameRunningState,
} from '../Manager/TeamManager.js';

import { spawnLeaderboardNPC } from '../Manager/LeaderboardNPC.js';

import {
   dynamicToast,
   getOverworld,
   setAdventure,
   setSurvival,
   SND_PLING,
} from '../plugin/Util.js';
import bf from './BlockFiller.js';

import bm, { ctx, icons, MinecraftColor, ticks } from './BorderManager.js';

import tlm from './UhcMatchManager_Teleport.js';
import vic from './UhcMatchManager_Victory.js';
import utilUmm from './UtilUhcMatchManager.js';

const PVP_DELAY = 20;
const PVP_TICK = 700 + PVP_DELAY;
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

//ตัวจัดการหลักของ UHC Match: game loop, start/end/reset, PVP countdown, scatter
class UhcMatchManager {
   startBars;

   constructor() {
      const prefix = '§fGame Start §l»§r ';
      const bars = new Array(actionBar + 1);
      for (let tick = 0; tick <= actionBar; tick++) {
         const remaining = actionBar - tick;
         const filled = ((tick * actionNum) / actionBar) | 0;
         const empty = actionNum - filled;
         bars[tick] =
            prefix +
            MinecraftColor.darkAqua +
            '▌'.repeat(filled) +
            MinecraftColor.gray +
            '▌'.repeat(empty) +
            MinecraftColor.white +
            ` ${remaining}`;
      }
      this.startBars = bars;

      registerAliveTeamDirtyHandler(() => this.markAliveTeamDirty());
   }

   // หยุดเกมถ้าเซิร์ฟเวอร์ว่าง
   handlePlayerLeave() {
      system.run(() => {
         if (ctx.isRunning && world.getPlayers().length === 0) {
            this.stopGameLoop();
         }
      });
   }

   // เริ่มเกมใหม่ถ้ามีผู้เล่นกลับมา
   handlePlayerSpawn(event) {
      if (ctx.isRunning && ctx.checkInterval === null) {
         this.gameLoopRun();
      }
   }

   // ดึงผู้เล่น UHC จาก cache ถ้าว่างให้รีเฟรช
   getUhcPlayersCached() {
      const players = getUhcPlayers();
      if (players.length > 0) {
         ctx.cacheRetryTick = 0;
         return players;
      }

      if (ctx.uhcTick < ctx.cacheRetryTick + 5) return players;
      ctx.cacheRetryTick = ctx.uhcTick;

      refreshPlayerCaches();
      return getUhcPlayers();
   }

   // spawn อนุภาคระเบิดที่ตำแหน่งผู้เล่น
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
         console.error('[UHC] Failed to spawn explosion particle:', error);
      }
   }

   // จัดการสถานะผู้เล่น Adventure → Survival
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

   // แสดง action bar countdown
   playerSetupDisplayGameStart(player) {
      const tick = ctx.countdownTicks;
      if (tick < 0 || tick > actionBar) return;
      if (!player?.isValid) return;
      const remaining = actionBar - tick,
         playSound = remaining === 20 || remaining === 10 || remaining <= 5;
      player.onScreenDisplay.setActionBar(this.startBars[tick]);
      if (playSound) player.playSound(SND_PLING, { volume: 1, pitch: 1 });
   }

   // หยุด game loop
   stopGameLoop() {
      if (ctx.checkInterval === null) return;
      system.clearRun(ctx.checkInterval);
      ctx.checkInterval = null;
   }

   // event โลก: scatter + PVP countdown
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
               const uhcPlayers = getUhcPlayers();
               for (let i = 0; i < uhcPlayers.length; i++) {
                  if (uhcPlayers[i]?.isValid) utilUmm.playerSetupAddItems(uhcPlayers[i]);
               }
            });
            break;
         case PVP_WARN:
            bm.broadcast({
               message: dynamicToast(
                  `PVP starts in ${MinecraftColor.red}${PVP_DELAY} ${MinecraftColor.white}s`,
                  'textures/ui/icon_multiplayer',
               ),
               sound: 'noti',
            });
            break;
         case PVP_CD3:
         case PVP_CD2:
         case PVP_CD1:
            bm.broadcast({
               message: dynamicToast(`PVP in ${MinecraftColor.red}${PVP_TICK - tick}`),
               sound: SND_PLING,
            });
            break;
         case PVP_TICK:
            world.gameRules.pvp = true;
            bm.broadcast({
               message: dynamicToast('PVP enabled!!', 'textures/ui/strength_effect'),
               title: icons.Sword,
               subtitle: MinecraftColor.green + 'PVP enabled!!',
               sound: 'world_noti',
            });
            break;
      }
   }

   // วนผู้เล่น: setup + display (หลัง scatter เสร็จ)
   gameLoopPlayersTick(players) {
      if (!ctx.teleportComplete || !players.length || ctx.countdownTicks > 26) return;

      const tick = ctx.countdownTicks;

      for (let i = 0; i < players.length; i++) {
         const p = players[i];
         if (!p?.isValid) continue;

         this.playerSetupHandleGameStart(p, tick);
         this.playerSetupDisplayGameStart(p);
      }
   }

   // border + scoreboard + damage
   gameLoopWorld(uhcPlayers) {
      bm.borderManagerTick();

      bm.borderManagerTickShrink();

      if (ctx.isRunning && ctx.uhcTick <= PVP_TICK) {
         this.gameLoopHandleWorldStart(ctx.uhcTick, uhcPlayers);
      }

      if (ctx.objective && ctx.uhcTick) {
         bm.scoreboardUpdate(ctx.objective, uhcPlayers);
      }

      if (uhcPlayers.length > 0) {
         const DAMAGE_BATCH = Math.max(1, Math.ceil(uhcPlayers.length / 5));

         for (let i = 0; i < DAMAGE_BATCH; i++) {
            if (ctx.borderDamageIndex >= uhcPlayers.length) ctx.borderDamageIndex = 0;
            bm.borderManagerApplyDamage(uhcPlayers[ctx.borderDamageIndex]);
            ctx.borderDamageIndex++;
         }
      }

      bm.particleRendererTick(uhcPlayers);
   }

   // เริ่ม game loop
   gameLoopRun() {
      ctx.checkInterval = system.runInterval(() => {
         try {
            if (!ctx.isRunning) return;
            ctx.uhcTick++;

            if (ctx.teleportComplete) {
               ctx.countdownTicks++;
            }

            // if (ctx.uhcTick % 60 === 0) {
            //    vic.victoryManagerCheck();
            // }

            const uhcPlayers = this.getUhcPlayersCached();
            this.gameLoopWorld(uhcPlayers);

            if (ctx.countdownTicks <= 26) {
               this.gameLoopPlayersTick(uhcPlayers);
            }
         } catch (error) {
            console.error('[UHC] Game loop error at tick ' + ctx.uhcTick + ':', error);
         }
      }, ticks);
   }

   // สั่งให้ sidebar re-render
   markAliveTeamDirty() {
      ctx.aliveTeamDirty = true;
   }

   // START / END / RESET

   // เริ่ม UHC
   startGameUhc() {
      if (ctx.isRunning) return;

      vic.resetCountdownRunning();
      this.stopGameLoop();
      this.initializeGameState();
      this.setupPlayers();
      this.gameLoopRun();
   }

   // เตรียม state ก่อนเริ่ม
   initializeGameState() {
      ctx.isRunning = true;
      ctx.prevShowCoordinates = world.gameRules.showCoordinates;
      ctx.uhcTick = 0;
      ctx.teleportComplete = false;
      ctx.countdownTicks = -1;
      try {
         ctx.cachedDimension = getOverworld();
      } catch (error) {
         console.error('[UHC] Failed to get overworld dimension:', error);
         ctx.cachedDimension = null;
      }

      tlm.safeYCache.clear();
      tlm.abortAllTeleportQueues();

      setGameRunningState(true);
      bm.init();
      bm.resetBorderState();
      bm.resetUiState();
      bm.scoreboardInit();
   }

   // batch ล้างของ + ตั้งค่าผู้เล่น
   setupPlayers() {
      const players = world.getPlayers();
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

   // จบเกม
   endGameUhc() {
      world.setDifficulty(Difficulty.Peaceful);
      const prevShowCoordinates = ctx.prevShowCoordinates;

      this.stopGameLoop();
      vic.resetCountdownRunning();

      this.cleanupGameState();
      this.resetPlayerStates();
      this.restoreWorldSettings(prevShowCoordinates);
   }

   cleanupGameState() {
      tlm.abortAllTeleportQueues();
      bf.fillReset();
      bm.endSequenceReset();
      bm.scoreboardClear();
      resetAnnouncer();
      setGameRunningState(false);
      refreshScoreboardUI();
      bm.resetContext(ctx);
   }

   // batch reset ผู้เล่น UHC
   resetPlayerStates() {
      const players = getUhcPlayers();
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
      bm.borderManagerSyncGeometry();
   }

   // hard reset
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
      bf.fillReset();
      bm.resetContext(ctx);
      bm.endSequenceReset();
      tlm.abortAllTeleportQueues();

      clearAllPlayerNametags();
      setGameRunningState(false);
      bm.scoreboardClear();
      clearAllTaguhcAndDynamicProperty();
      refreshScoreboardUI();
   }

   // batch reset ผู้เล่นทั้งหมดในโลก
   resetAllPlayers() {
      const players = world.getPlayers();
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
      bm.borderManagerSyncGeometry();
      world.gameRules.pvp = false;
      world.gameRules.showCoordinates = prevShowCoordinates;
   }
}

export default new UhcMatchManager();
