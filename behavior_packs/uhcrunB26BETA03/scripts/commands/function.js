import { CommandPermissionLevel, CustomCommandStatus, Difficulty, InputPermissionCategory, ItemStack, system, world } from '@minecraft/server';
import { CONFIG, MENU_MSG, SPAWN_CONFIG, TICKING_AREAS } from '../constants/game.js';
import { spawnLeaderboardNPC, updateLeaderboard } from '../features/leaderboard/LeaderboardManager.js';
import { isGameRunning } from '../features/match/State_Game.js';
import matchManager from '../features/match/MatchManager.js';
import { getPlayerInventoryContainer } from '../features/cache/CacheManager.js';
import { showTeleportForm } from '../ui/menu/MenuTeleport.js';
import { openMainMenu } from '../ui/menu/MenuMain.js';
import { COMPASS_ITEM, logError, logWarn, setAdventure } from '../shared/Util.js';

//เอฟเฟกต์เริ่มต้นสำหรับ setup/reset: regen, resistance, saturation
const SETUP_RESET_EFFECTS = Object.freeze([
   { type: 'regeneration', duration: 500 },
   { type: 'resistance', duration: 500 },
   { type: 'saturation', duration: 500 },
]);

//ป้องกัน lifecycle ซ้อนกัน ป้องกันคำสั่งทำงานพร้อมกัน
let lifecycleLock = null;

//เริ่ม lifecycle ถ้ายังไม่มีงานอื่นทำงานอยู่
function beginLifecycle(opName) {
   if (lifecycleLock) {
      world.sendMessage(`§c[UHC] Busy: ${lifecycleLock} is still running.`);
      return false;
   }
   lifecycleLock = opName;
   return true;
}

//จบ lifecycle ปลดล็อค
function endLifecycle(opName) {
   if (lifecycleLock === opName) {
      lifecycleLock = null;
   }
}

//ประมวลผลผู้เล่นทีละ batch ป้องกัน server lag
function batch({ step, budget = 1, onDone }) {
   const players = world.getPlayers();
   let i = 0;

   if (players.length === 0) {
      if (typeof onDone === 'function') onDone();
      return;
   }

   const run = system.runInterval(() => {
      const batchPlayers = players.slice(i, i + budget);
      i += batchPlayers.length;

      for (let bi = 0, bLen = batchPlayers.length; bi < bLen; bi++) {
         const player = batchPlayers[bi];
         if (!player?.isValid) continue;
         try {
            step(player);
         } catch (error) {
            logError('batch', 'step error for player', error);
         }
      }

      if (i >= players.length) {
         system.clearRun(run);
         if (typeof onDone === 'function') onDone();
      }
   }, 2);
}

//รันคำสั่งใน overworld dimension เท่านั้น
function cmd(commandString) {
   try {
      world.getDimension(SPAWN_CONFIG.dimension).runCommand(commandString);
   } catch (error) {
      logError('cmd', 'Failed: ' + commandString, error);
   }
}

//ล้าง inventory ผู้เล่นและให้ compass
function setItemPlayer(player) {
   const container = getPlayerInventoryContainer(player);
   if (!container) return;
   container.clearAll();
   container.setItem(0, new ItemStack(COMPASS_ITEM, 1));
}

//เพิ่ม effect ให้ผู้เล่น
function applyEffects(player, effects = []) {
   for (let ei = 0, eLen = effects.length; ei < eLen; ei++) {
      const { type, duration, amp = 0 } = effects[ei];
      try {
         player.addEffect(type, duration, {
            amplifier: amp,
            showParticles: false,
         });
      } catch (error) {
         logError('Command', 'Failed to apply effect ' + type, error);
      }
   }
}

//เทเลพอร์ตผู้เล่นไป spawn พร้อมตั้งค่า adventure mode
function setPlayerSpawn(player) {
   if (!player?.isValid) return;
   try {
      player.playSound('spawn');
      setAdventure(player);
      player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
      player.teleport({ x: SPAWN_CONFIG.x, y: SPAWN_CONFIG.y, z: SPAWN_CONFIG.z }, { dimension: world.getDimension(SPAWN_CONFIG.dimension) });
   } catch (error) {
      logError('Command', 'Failed to set player spawn for ' + player.name, error);
   }
}

//Pipeline: setup หรือ reset ผู้เล่น
function setupOrReset(player) {
   setItemPlayer(player);
   setPlayerSpawn(player);
   applyEffects(player, SETUP_RESET_EFFECTS);
}

//Pipeline: จบเกม เคลียร์ effect และระดับผู้เล่น
function end(player) {
   setItemPlayer(player);
   applyEffects(player, [{ type: 'regeneration', duration: 255 }]);
   player.addLevels(-10000);

   player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
}

//ตั้งค่า world ก่อนเริ่ม UHC (spawn, gamerules, leaderboard)
function uhcSetup() {
   if (!beginLifecycle('setup')) return;
   try {
      world.sendMessage(
         '§7------------ UHCRun26 -----------\n' + '§f Battle. Survive. Win.\n' + '§f Presented by Sleeplite\n' + '§9Join the community > discord.gg/gtqfbmvTJK\n' + '§7------------------------------',
      );

      //สร้าง ticking area ตามรัศมีเริ่มต้น 500
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
      throw error;
   }
}

//รีเซ็ต world กลับไปก่อนเริ่มเกม
function uhcReset() {
   if (!beginLifecycle('reset')) return;
   try {
      world.sendMessage('[UHC] Reset complete.');

      matchManager.resetGameUhc();

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
      throw error;
   }
}

//เริ่ม match UHC: เปิด PVP, mob, fall damage
function uhcStart() {
   if (!beginLifecycle('start')) return;
   try {
      cmd('daylock false');

      matchManager.startGameUhc();

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
      throw error;
   }
}

//จบ match UHC: เคลียร์ effect, ปิด PVP
function uhcEnd() {
   if (!beginLifecycle('end')) return;
   try {
      world.sendMessage('[UHC] The game is over.');
      cmd('effect @a clear');

      matchManager.endGameUhc();

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
      throw error;
   }
}

//เริ่มต้น TPA (random สำหรับ non admin, form สำหรับ admin)
function tpa(player) {
   system.run(() => {
      if (!player?.isValid) return;
      if (!isGameRunning) return;
      if (player.hasTag(CONFIG.adminTag)) {
         showTeleportForm(player, true);
         return;
      }
      if (player.hasTag(CONFIG.uhcTag)) {
         player.sendMessage(MENU_MSG.tpaBlockedInUhc);
         return;
      }
      showTeleportForm(player, false);
   });
}

//ลงทะเบียน custom slash command ทั้งหมดผ่าน system.beforeEvents.startup
export function HandlerCustomCommands({ customCommandRegistry }) {
   for (const name in CommandMap) {
      const data = CommandMap[name];

      try {
         customCommandRegistry.registerCommand(
            {
               name,
               description: data.description,
               permissionLevel: data.permission,
               cheatsRequired: false,
            },
            (origin) => {
               const source = origin.initiator ?? origin.sourceEntity;

               system.run(() => {
                  try {
                     data.handler(source);
                  } catch (error) {
                     logError('Command', name + ' failed', error);
                     if (source?.isValid && typeof source.sendMessage === 'function') {
                        source.sendMessage(`§c[Command] §f${name} §cfailed: ${error?.message ?? error}`);
                     }
                  }
               });

               return { status: CustomCommandStatus.Success };
            },
         );
      } catch (error) {
         logError('Command', "Failed to register custom command '" + name + "'", error);
      }
   }
}

//ทะเบียนคำสั่ง custom command
export const CommandMap = {
   'addon:uhcsetup': {
      description: 'Setup UHC world (spawn, gamerules, leaderboard)',
      handler: uhcSetup,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcreset': {
      description: 'Reset UHC world to pre-game state',
      handler: uhcReset,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcstart': {
      description: 'Start the UHC match (spread players, enable PVP)',
      handler: uhcStart,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcend': {
      description: 'End the UHC match',
      handler: uhcEnd,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:tpa': {
      description: 'Request to teleport to another player',
      handler: tpa,
      permission: CommandPermissionLevel.Any,
   },
   'addon:gui': {
      description: 'Open the main admin GUI menu',
      handler: openMainMenu,
      permission: CommandPermissionLevel.GameDirectors,
   },
};
