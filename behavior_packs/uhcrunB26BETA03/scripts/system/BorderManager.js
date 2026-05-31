import { getAllPlayers, getUhcPlayers } from '../Manager/TeamManager.js';
import { dynamicToast } from '../plugin/Util.js';
import bf from './BlockFiller.js';
import { END_SEQUENCE_STATE } from './BlockFillerUtil.js';
import particleInstance from './BorderManager_Particle.js';
import scoreboardInstance from './BorderManager_Scoreboard.js';
import shrinkInstance from './BorderManager_Shrink.js';
import warningDamageInstance from './BorderManager_WarningDamage.js';

export const icons = Object.freeze({
    Sword: '',
    Bow: '',
    shield: '',
    Helmet: '',
    Border: '',
    Mojang: '',
    Bot: '',
    Sailboat: '',
    FourGrid: '',
    Corners: '',
    Diagonal: '',
    Burst: '',
    Clock: '',
    Square: '',
    Bars: '',
    Frame: '',
    Hourglass: '',
});

export const MinecraftColor = Object.freeze({
    black: '§0',
    darkBlue: '§1',
    darkGreen: '§2',
    darkAqua: '§3',
    darkRed: '§4',
    darkPurple: '§5',
    gold: '§6',
    gray: '§7',
    darkGray: '§8',
    blue: '§9',
    green: '§a',
    aqua: '§b',
    red: '§c',
    lightPurple: '§d',
    yellow: '§e',
    white: '§f',
    minecoinGold: '§g',
    h: '§h',
    n: '§n',
});

export const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];

export const borderEnd = CHECKPOINTS[CHECKPOINTS.length - 1];

export const borderColors = {
    blue: { red: 0, green: 0.54, blue: 1, alpha: 1.0 },
    red: { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 },
};

export const ticks = 20;
export const center = { x: 0, z: 0 };

export function GameContext() {
    return {
        isRunning: false,
        uhcTick: 0,
        checkInterval: null,
        cachedDimension: null,
        fillCommandLocked: false,
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
        aliveTeamBarCache: MinecraftColor.gray + '-',
        aliveTeamDirty: true,
        lastBorderRadius: -1,
        lastPlayerCount: -1,
        lastTargetRadius: null,
        borderMolang: null,
    };
}

export const ctx = GameContext();

const titleConfig = Object.freeze({ stayDuration: 200, fadeInDuration: 10, fadeOutDuration: 20 });
const soundConfig = Object.freeze({ volume: 0.8, pitch: 1 });

const reusableTitleOptions = {
    stayDuration: titleConfig.stayDuration,
    fadeInDuration: titleConfig.fadeInDuration,
    fadeOutDuration: titleConfig.fadeOutDuration,
    subtitle: '',
};

class BorderManager {
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
        ctx.aliveTeamDirty = true;
        ctx.aliveTeamBarCache = MinecraftColor.gray + '-';
        ctx.lastBorderRadius = -1;
        ctx.lastPlayerCount = -1;
        ctx.lastTargetRadius = null;
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
            this.broadcast(getUhcPlayers(), {
                message: dynamicToast('Border ถึงวงสุดท้ายแล้ว!', 'textures/blocks/barrier'),
                sound: 'world_noti',
            });
            return;
        }

        if (!bf.shouldAdvanceEndSequence(ctx.uhcTick, ctx.endSeqState, ctx.endSeqStartTick, bf.fillHasPendingWork())) return;

        const step = bf.getEndSequenceStep(ctx.endSeqState);
        if (!step) return;

        ctx.endSeqState = step.nextState;
        ctx.endSeqStartTick = ctx.uhcTick;

        const players = getUhcPlayers();
        this.broadcast(players, { message: dynamicToast(step.message, step.icon), sound: 'world_noti' });

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
            targets = getAllPlayers();
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
            reusableTitleOptions.subtitle = typeof subtitle === 'string' ? subtitle : '';
            titleOptions = reusableTitleOptions;
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
    }

    // Scoreboard delegates
    scoreboardInit() {
        return scoreboardInstance.scoreboardInit();
    }
    scoreboardClear() {
        return scoreboardInstance.scoreboardClear();
    }
    scoreboardMakeLineId(text, index) {
        return scoreboardInstance.scoreboardMakeLineId(text, index);
    }
    scoreboardUpdateLine(obj, index, text) {
        return scoreboardInstance.scoreboardUpdateLine(obj, index, text);
    }
    scoreboardComputeNextLabel() {
        return scoreboardInstance.scoreboardComputeNextLabel();
    }
    scoreboardComputeNextBorder() {
        return scoreboardInstance.scoreboardComputeNextBorder();
    }
    scoreboardCollectAliveTeams(players) {
        return scoreboardInstance.scoreboardCollectAliveTeams(players);
    }
    scoreboardGetAliveTeamBar(players) {
        return scoreboardInstance.scoreboardGetAliveTeamBar(players);
    }
    scoreboardGetGameState() {
        return scoreboardInstance.scoreboardGetGameState();
    }
    scoreboardUpdate(obj, uhcPlayers) {
        return scoreboardInstance.scoreboardUpdate(obj, uhcPlayers);
    }

    // Warning/Damage delegates
    borderManagerGetPlayerWarningLevel(player) {
        return warningDamageInstance.borderManagerGetPlayerWarningLevel(player);
    }
    borderManagerUpdatePlayerWarningData(playerId, warningInfo) {
        return warningDamageInstance.borderManagerUpdatePlayerWarningData(playerId, warningInfo);
    }
    borderManagerPlayWarningSound(player, level) {
        return warningDamageInstance.borderManagerPlayWarningSound(player, level);
    }
    borderManagerProcessWarningSounds(players) {
        return warningDamageInstance.borderManagerProcessWarningSounds(players);
    }
    borderManagerCleanupWarningData(activePlayers) {
        return warningDamageInstance.borderManagerCleanupWarningData(activePlayers);
    }
    borderManagerApplyDamage(player) {
        return warningDamageInstance.borderManagerApplyDamage(player);
    }

    // Shrink delegates
    getTeamsCached() {
        return shrinkInstance.getTeamsCached();
    }
    lookupShrinkConfig(target) {
        return shrinkInstance.lookupShrinkConfig(target);
    }
    borderManagerGetShrinkDuration(target) {
        return shrinkInstance.borderManagerGetShrinkDuration(target);
    }
    borderManagerGetRestTime(target) {
        return shrinkInstance.borderManagerGetRestTime(target);
    }
    borderManagerSyncGeometry() {
        return shrinkInstance.borderManagerSyncGeometry();
    }
    borderManagerSetRadius(r) {
        return shrinkInstance.borderManagerSetRadius(r);
    }
    borderManagerIsOutside(x, z) {
        return shrinkInstance.borderManagerIsOutside(x, z);
    }
    borderManagerTickShrink() {
        return shrinkInstance.borderManagerTickShrink();
    }
    borderManagerApplyShrink() {
        return shrinkInstance.borderManagerApplyShrink();
    }
    borderManagerBroadcastWarning() {
        return shrinkInstance.borderManagerBroadcastWarning();
    }
}

export default new BorderManager();
