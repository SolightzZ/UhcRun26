import { Difficulty, world } from '@minecraft/server';
import { SPAWN_CONFIG, TICKING_AREAS } from '../constants/game.js';
import { spawnLeaderboardNPC, updateLeaderboard } from '../features/leaderboard/LeaderboardManager.js';
import MatchManager from '../features/match/MatchManager.js';
import { logError } from '../shared/Util.js';
import { confirmAction } from './confirmAction.js';
import { beginLifecycle, endLifecycle } from './lifecycle.js';
import { batch, cmd, end, setupOrReset } from './playerUtil.js';

export function uhcSetup(source) {
   confirmAction(
      source,
      'Setup UHC World',
      '§7This will:\n§7• §fSet up spawn and ticking areas\n§7• §fConfigure game rules\n§7• §fTeleport all players to spawn\n§7• §fSpawn leaderboard NPC\n\n§eAre you sure you want to proceed?',
      () => {
         if (!beginLifecycle('setup')) return;
         try {
            world.sendMessage(
               '§7------------ UHCRun26 -----------\n' +
                  '§f Battle. Survive. Win.\n' +
                  '§f Presented by Sleeplite\n' +
                  '§9Join the community > discord.gg/gtqfbmvTJK\n' +
                  '§7------------------------------',
            );

            for (let i = 0, aLen = TICKING_AREAS.length; i < aLen; i++) {
               cmd(TICKING_AREAS[i]);
            }

            world.gameRules.sendCommandFeedback = false;
            world.gameRules.commandBlockOutput = false;
            world.gameRules.naturalRegeneration = true;
            world.gameRules.doImmediateRespawn = true;
            world.gameRules.showCoordinates = false;
            world.gameRules.doWeatherCycle = false;
            world.gameRules.doMobSpawning = false;
            world.gameRules.mobGriefing = false;
            world.gameRules.fallDamage = false;
            world.gameRules.doMobLoot = false;
            world.gameRules.spawnRadius = 1;
            world.gameRules.pvp = false;
            world.gameRules.locatorBar = false;
            world.setDifficulty(Difficulty.Peaceful);

            cmd('clearspawnpoint @a');
            cmd(`setworldspawn ${SPAWN_CONFIG.worldSpawn}`);

            batch({
               step: setupOrReset,
               budget: 1,
               onDone: () => {
                  endLifecycle('setup');
               },
            });

            spawnLeaderboardNPC();
            updateLeaderboard();
         } catch (error) {
            endLifecycle('setup');
            logError('UHC', 'uhcSetup failed', error);
         }
      },
   );
}

export function uhcReset(source) {
   confirmAction(
      source,
      'Reset UHC World',
      '§7This will:\n§7• §fReset all match data\n§7• §fTeleport all players to spawn\n§7• §fClear inventories\n§7• §fSet game rules to pre-game state\n\n§cAll progress will be lost!\n\n§eAre you sure you want to proceed?',
      () => {
         if (!beginLifecycle('reset')) return;
         try {
            world.sendMessage('[UHC] Reset complete.');

            MatchManager.resetGameUhc();

            world.gameRules.naturalRegeneration = true;
            world.gameRules.showCoordinates = false;
            world.gameRules.doMobSpawning = false;
            world.gameRules.mobGriefing = false;
            world.gameRules.fallDamage = false;
            world.gameRules.doMobLoot = false;
            world.gameRules.pvp = false;
            world.setDifficulty(Difficulty.Peaceful);

            cmd('clearspawnpoint @a');
            cmd(`setworldspawn ${SPAWN_CONFIG.worldSpawn}`);

            batch({
               step: setupOrReset,
               budget: 1,
               onDone: () => {
                  endLifecycle('reset');
               },
            });

            spawnLeaderboardNPC();
            updateLeaderboard();
         } catch (error) {
            endLifecycle('reset');
            logError('UHC', 'uhcReset failed', error);
         }
      },
   );
}

export function uhcStart(source) {
   confirmAction(
      source,
      'Start UHC Match',
      '§7This will:\n§7• §fEnable PvP and natural damage\n§7• §fStart the match timer\n§7• §fShow coordinates\n§7• §fEnable mob spawning\n\n§eAre you sure you want to start?',
      () => {
         if (!beginLifecycle('start')) return;
         try {
            cmd('daylock false');

            MatchManager.startGameUhc();

            world.gameRules.naturalRegeneration = false;
            world.gameRules.showCoordinates = true;
            world.gameRules.doMobSpawning = true;
            world.gameRules.mobGriefing = true;
            world.gameRules.fallDamage = true;
            world.gameRules.doMobLoot = true;
            world.gameRules.pvp = false;
            world.setDifficulty(Difficulty.Normal);
            world.setTimeOfDay(22999);

            cmd('clearspawnpoint @a');
            cmd('setworldspawn 0 100 0');
            endLifecycle('start');
         } catch (error) {
            endLifecycle('start');
            logError('UHC', 'uhcStart failed', error);
         }
      },
   );
}

export function uhcEnd(source) {
   confirmAction(
      source,
      'End UHC Match',
      '§7This will:\n§7• §fEnd the current match\n§7• §fClear all effects\n§7• §fDisable PvP and fall damage\n§7• §fTeleport all players to spawn\n\n§cThe game will be stopped immediately.\n\n§eAre you sure you want to end?',
      () => {
         if (!beginLifecycle('end')) return;
         try {
            world.sendMessage('[UHC] The game is over.');
            cmd('effect @a clear');

            MatchManager.endGameUhc();

            world.gameRules.pvp = false;
            world.gameRules.fallDamage = false;
            world.gameRules.mobGriefing = false;
            world.gameRules.showCoordinates = false;
            world.gameRules.naturalRegeneration = true;
            world.setDifficulty(Difficulty.Peaceful);

            cmd('clearspawnpoint @a');
            cmd(`setworldspawn ${SPAWN_CONFIG.worldSpawn}`);
            batch({
               step: end,
               budget: 1,
               onDone: () => {
                  endLifecycle('end');
               },
            });
         } catch (error) {
            endLifecycle('end');
            logError('UHC', 'uhcEnd failed', error);
         }
      },
   );
}
