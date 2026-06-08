import { Difficulty, GameMode, InputPermissionCategory, system, world } from '@minecraft/server';

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

import { dynamicToast } from '../plugin/Util.js';
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

        registerAliveTeamDirtyHandler(() => this.markAliveTeamDirty());
    }

    handlePlayerLeave() {
        system.run(() => {
            // Stop game loop only when server is completely empty
            if (ctx.isRunning && world.getPlayers().length === 0) {
                this.stopGameLoop();
            }
        });
    }

    handlePlayerSpawn(event) {
        if (ctx.isRunning && ctx.checkInterval === null) {
            this.gameLoopRun();
        }
    }

    getUhcPlayersCached() {
        const players = getUhcPlayers();
        if (players.length > 0) return players;

        // Use cached allPlayersCache from TeamManager instead of world.getPlayers()
        refreshPlayerCaches();
        return getUhcPlayers();
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
        } catch (e) {
            console.warn('[UHC] Failed to spawn explosion particle:', e);
        }
    }

    playerSetupHandleGameStart(player, tick) {
        if (tick > 26) return;

        const input = player.inputPermissions;

        switch (tick) {
            case 1:
                player.setGameMode(GameMode.Adventure);
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
                player.setGameMode(GameMode.Survival);
                player.removeEffect('invisibility');
                player.onScreenDisplay.setTitle('Good Luck, Have Fun');
                player.playSound('random.explode', soundOptionsExplode);
                this.playerSetupSpawnParticles(player);
                break;
        }
    }

    playerSetupDisplayGameStart(player) {
        const tick = ctx.uhcTick;
        if (tick < 0 || tick > actionBar) return;
        if (!player?.isValid) return;
        const remaining = actionBar - tick,
            playSound = remaining === 20 || remaining === 10 || remaining <= 5;
        player.onScreenDisplay.setActionBar(this.startBars[tick]);
        if (playSound) player.playSound('note.pling', { volume: 1, pitch: 1 });
    }

    stopGameLoop() {
        if (ctx.checkInterval === null) return;
        system.clearRun(ctx.checkInterval);
        ctx.checkInterval = null;
    }

    gameLoopHandleWorldStart(tick, players) {
        if (tick > PVP_TICK + 1 || !players.length) return;

        switch (tick) {
            case 1:
                tlm.teleportManagerTeleportTeam();
                break;
            case 24:
                for (let i = 0; i < players.length; i++) {
                    if (players[i]?.isValid) utilUmm.playerSetupAddItems(players[i]);
                }
                break;
            case 26:
                world.gameRules.showCoordinates = true;
                world.gameRules.pvp = false;
                world.sendMessage('[UHC] Good Luck, Have Fun');
                break;
            case PVP_WARN:
                bm.broadcast({
                    message: dynamicToast(`PVP starts in ${MinecraftColor.red}${PVP_DELAY} ${MinecraftColor.white}s`, 'textures/ui/icon_multiplayer'),
                    sound: 'noti',
                });
                break;
            case PVP_CD3:
            case PVP_CD2:
            case PVP_CD1:
                bm.broadcast({
                    message: dynamicToast(`PVP in ${MinecraftColor.red}${PVP_TICK - tick}`),
                    sound: 'note.pling',
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

    gameLoopPlayersTick(players) {
        if (!players.length || ctx.uhcTick > 26) return;

        const tick = ctx.uhcTick;

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p?.isValid) continue;

            this.playerSetupHandleGameStart(p, tick);
            this.playerSetupDisplayGameStart(p);
        }
    }

    gameLoopWorld(uhcPlayers) {
        bm.borderManagerTick();
        bm.borderManagerTickShrink();
        if (ctx.isRunning && ctx.uhcTick <= PVP_TICK) this.gameLoopHandleWorldStart(ctx.uhcTick, uhcPlayers);
        if (ctx.objective && ctx.uhcTick % 2 === 0) bm.scoreboardUpdate(ctx.objective, uhcPlayers);
        // Border damage every 5 ticks instead of every tick — reduces 30 calls/tick to 6 calls/tick
        if (ctx.uhcTick % 5 === 0) {
            for (let i = 0; i < uhcPlayers.length; i++) {
                bm.borderManagerApplyDamage(uhcPlayers[i]);
            }
        }
        bm.particleRendererTick(uhcPlayers);
    }

    gameLoopRun() {
        ctx.checkInterval = system.runInterval(() => {
            if (!ctx.isRunning) return;
            ctx.uhcTick++;

            if (ctx.uhcTick % 60 === 0) vic.victoryManagerCheck();

            const uhcPlayers = this.getUhcPlayersCached();
            this.gameLoopWorld(uhcPlayers);

            if (ctx.uhcTick <= 26) {
                this.gameLoopPlayersTick(uhcPlayers);
            }
        }, ticks);
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
        ctx.isRunning = true;
        ctx.prevShowCoordinates = world.gameRules.showCoordinates;
        ctx.uhcTick = 0;
        ctx.cachedDimension = world.getDimension('overworld');

        tlm.safeYCache.clear();
        tlm.abortAllTeleportQueues();

        setGameRunningState(true);
        bm.init();
        bm.resetBorderState();
        bm.resetUiState();
        bm.scoreboardInit();
    }

    setupPlayers() {
        // Must use world.getPlayers() — uhc tags haven't been applied yet
        // (applyStartState adds the tag; refreshPlayerCaches rebuilds cache after)
        const players = world.getPlayers();

        utilUmm.playerSetupClearItemsKeepCompass();

        for (let i = 0; i < players.length; i++) {
            utilUmm.playerSetupApplyStartState(players[i]);
        }

        refreshPlayerCaches();
    }

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

    resetPlayerStates() {
        // Called during endGameUhc — cleanupGameState runs first but doesn't
        // remove 'uhc' tags (that happens in applyEndState within this loop)
        // So getUhcPlayers() is safe here
        const players = getUhcPlayers();
        for (let i = 0; i < players.length; i++) {
            utilUmm.playerSetupApplyEndState(players[i]);
        }
    }

    restoreWorldSettings(prevShowCoordinates) {
        world.gameRules.showCoordinates = prevShowCoordinates;
        bm.borderManagerSyncGeometry();
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

    resetAllPlayers() {
        // Must use world.getPlayers() — cleanupResetState (called before this)
        // already removed all 'uhc' tags via clearAllTaguhcAndDynamicProperty
        const players = world.getPlayers();

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p?.isValid) continue;

            utilUmm.playerSetupClearEffects(p);
            utilUmm.playerSetupApplyEndState(p);
        }

        utilUmm.playerSetupClearItemsKeepCompass();
    }

    restoreWorldDefaults(prevShowCoordinates) {
        bm.borderManagerSyncGeometry();
        world.gameRules.pvp = false;
        world.gameRules.showCoordinates = prevShowCoordinates;
    }
}

export default new UhcMatchManager();
