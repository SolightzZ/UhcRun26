import { CommandPermissionLevel, Difficulty, GameMode, InputPermissionCategory, ItemStack, system, world } from '@minecraft/server';
import { spawnLeaderboardNPC, updateLeaderboard } from '../Manager/LeaderboardNPC.js';
import { openMainMenu, tpa } from '../Manager/TeamManager.js';
import { endGameUhc, resetGameUhc, startGameUhc } from '../system/border.js';

// CONFIG
export const SPAWN_CONFIG = Object.freeze({
    x: 596,
    y: 130,
    z: 609,
    dimension: 'overworld',
});

const SETUP_RESET_EFFECTS = Object.freeze([
    { type: 'regeneration', duration: 500 },
    { type: 'resistance', duration: 500 },
    { type: 'saturation', duration: 500 },
]);

// CORE UTILITIES
function batch({ step, budget = 1 }) {
    const players = world.getPlayers();
    let i = 0;

    const run = system.runInterval(() => {
        const batchPlayers = players.slice(i, i + budget);
        i += batchPlayers.length;

        for (const player of batchPlayers) {
            if (!player?.isValid) continue;
            try {
                step(player);
            } catch (e) {
                console.warn(`[batch] step error for player:`, e);
            }
        }

        if (i >= players.length) system.clearRun(run);
    }, 2);
}

// OVERWORLD ONLY
function cmd(commandString) {
    try {
        world.getDimension(SPAWN_CONFIG.dimension).runCommand(commandString);
    } catch (e) {
        console.warn(`[cmd] Failed: ${commandString}`, e);
    }
}

// PLAYER STATE CONTROL
function setItemPlayer(player) {
    const invComp = player.getComponent('inventory');
    if (!invComp) return;
    invComp.container.clearAll();
    invComp.container.setItem(0, new ItemStack('minecraft:compass', 1));
}

function applyEffects(player, effects = []) {
    for (const { type, duration, amp = 0 } of effects) {
        player.addEffect(type, duration, { amplifier: amp, showParticles: false });
    }
}

function setPlayerSpawn(player) {
    player.playSound('spawn');
    player.setGameMode(GameMode.Adventure);
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
    player.teleport({ x: SPAWN_CONFIG.x, y: SPAWN_CONFIG.y, z: SPAWN_CONFIG.z }, { dimension: world.getDimension(SPAWN_CONFIG.dimension) });
}

// PLAYER PIPELINES
function setupOrReset(player) {
    setItemPlayer(player);
    setPlayerSpawn(player);
    applyEffects(player, SETUP_RESET_EFFECTS);
}

function end(player) {
    setItemPlayer(player);
    applyEffects(player, [{ type: 'regeneration', duration: 255 }]);
    player.addLevels(-10000);

    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, true);
}

// TICKING AREA SETUP
const TICKING_AREAS = Object.freeze([
    'tickingarea add -80 0 -80 79 255 79 center',
    'tickingarea add -80 0 80 79 255 239 north',
    'tickingarea add -80 0 -240 79 255 -81 south',
    'tickingarea add 80 0 -80 239 255 79 east',
    'tickingarea add -240 0 -80 -81 255 79 west',
    'tickingarea add 80 0 80 239 255 239 ne',
    'tickingarea add -240 0 80 -81 255 239 nw',
    'tickingarea add 80 0 -240 239 255 -81 se',
    'tickingarea add -240 0 -240 -81 255 -81 sw',
    'tickingarea add -80 0 240 79 255 399 far_north',
]);

// UHC WORLD LIFECYCLE
function uhcSetup() {
    world.sendMessage(
        '§7------------ UHCRun26 -----------\n' +
            '§f Battle. Survive. Win.\n' +
            '§f Presented by Sleeplite SMP\n' +
            '§9Join the community > discord.gg/gtqfbmvTJK\n' +
            '§7------------------------------',
    );

    for (const tickCmd of TICKING_AREAS) cmd(tickCmd);

    system.runTimeout(() => {
        try {
            cmd('structure load uhc1 569 100 569');
        } catch (e) {
            console.warn('[UHC] Failed to load structure uhc1: ', e);
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
    cmd('setworldspawn 596 125 622');

    batch({ step: setupOrReset, budget: 1 });

    spawnLeaderboardNPC();
    updateLeaderboard();
}

function uhcReset() {
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
    cmd('setworldspawn 596 125 622');

    batch({ step: setupOrReset, budget: 1 });

    spawnLeaderboardNPC();
    updateLeaderboard();
}

function uhcStart() {
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
}

function uhcEnd() {
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
    cmd('setworldspawn 596 125 622');
    batch({ step: end, budget: 1 });
}

// COMMAND REGISTRY
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
