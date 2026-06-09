import {
   CommandPermissionLevel,
   Difficulty,
   InputPermissionCategory,
   ItemStack,
   system,
   world,
} from '@minecraft/server';
import { spawnLeaderboardNPC, updateLeaderboard } from '../Manager/LeaderboardNPC.js';
import { openMainMenu, tpa } from '../Manager/TeamManager.js';
import { SPAWN_CONFIG } from '../Manager/UtilTeamManager.js';
import { COMPASS_ITEM, getPlayerInventoryContainer, setAdventure } from '../plugin/Util.js';
import { endGameUhc, resetGameUhc, startGameUhc } from '../system/border.js';

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
            console.error(`[batch] step error for player:`, error);
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
      console.error(`[cmd] Failed: ${commandString}`, error);
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
         console.error('[Command] Failed to apply effect', type, ':', error);
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
      player.teleport(
         { x: SPAWN_CONFIG.x, y: SPAWN_CONFIG.y, z: SPAWN_CONFIG.z },
         { dimension: world.getDimension(SPAWN_CONFIG.dimension) },
      );
   } catch (error) {
      console.error('[Command] Failed to set player spawn for', player.name, ':', error);
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
         '§7------------ UHCRun26 -----------\n' +
            '§f Battle. Survive. Win.\n' +
            '§f Presented by Sleeplite\n' +
            '§9Join the community > discord.gg/gtqfbmvTJK\n' +
            '§7------------------------------',
      );

      //สร้าง ticking area ตามรัศมีเริ่มต้น 500
      const areas = generateTickingAreas(500);
      for (let ai = 0, aLen = areas.length; ai < aLen; ai++) cmd(areas[ai]);

      system.runTimeout(() => {
         try {
            cmd(`structure load ${SPAWN_CONFIG.structureName} ${SPAWN_CONFIG.structureLoc}`);
         } catch (error) {
            console.error('[UHC] Failed to load structure uhc1:', error);
         }
      }, 10);

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
      console.error('[UHC] uhcSetup failed:', error);
      throw error;
   }
}

//รีเซ็ต world กลับไปก่อนเริ่มเกม
function uhcReset() {
   if (!beginLifecycle('reset')) return;
   try {
      world.sendMessage('[UHC] Reset complete.');

      resetGameUhc();

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
      console.error('[UHC] uhcReset failed:', error);
      throw error;
   }
}

//เริ่ม match UHC: เปิด PVP, mob, fall damage
function uhcStart() {
   if (!beginLifecycle('start')) return;
   try {
      cmd('daylock false');

      startGameUhc();

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
      console.error('[UHC] uhcStart failed:', error);
      throw error;
   }
}

//จบ match UHC: เคลียร์ effect, ปิด PVP
function uhcEnd() {
   if (!beginLifecycle('end')) return;
   try {
      world.sendMessage('[UHC] The game is over.');
      cmd('effect @a clear');

      endGameUhc();

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
      console.error('[UHC] uhcEnd failed:', error);
      throw error;
   }
}

//สร้าง ticking area ตามรัศมีที่กำหนดให้โลกทำงานได้
function generateTickingAreas(radius) {
   const r = Math.max(80, Math.ceil(radius / 16) * 16 + 32);
   return [`tickingarea add ${-r} 0 ${-r} ${r} 255 ${r} center`];
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
