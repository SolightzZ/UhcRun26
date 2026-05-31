import fillQueue from './BlockFiller_FillQueue.js';
import patternEnqueue from './BlockFiller_PatternEnqueue.js';
import util from './BlockFiller_Util.js';
import { END_SEQUENCE_STATE } from './BlockFiller_Constants.js';

class BlockFillerEndSequence {
    PATTERN_1_TASK;
    PATTERN_2_TASK;
    PATTERN_3_TASK;
    pattern1Queued = false;
    pattern2Queued = false;

    setPatternTasks(p1, p2, p3) {
        this.PATTERN_1_TASK = p1;
        this.PATTERN_2_TASK = p2;
        this.PATTERN_3_TASK = p3;
    }

    shouldAdvanceEndSequence(uhcTick, state, startTick, hasPendingWork) {
        if (startTick === -1) return false;
        const elapsed = uhcTick - startTick;
        switch (state) {
            case END_SEQUENCE_STATE.INITIAL_WAIT:
                return elapsed >= 100;
            case END_SEQUENCE_STATE.PATTERN3:
            case END_SEQUENCE_STATE.PATTERN1:
            case END_SEQUENCE_STATE.PATTERN2:
                return !hasPendingWork && elapsed >= 40;
            case END_SEQUENCE_STATE.COOLDOWN:
                return elapsed >= 100;
            default:
                return false;
        }
    }

    getEndSequenceStep(state) {
        const END_SEQUENCE_STEPS = [
            {
                nextState: END_SEQUENCE_STATE.PATTERN3,
                labelKey: 'pattern3',
                message: 'Nether wall border',
                icon: 'textures/blocks/nether_brick',
                run: (player) => this.runEndPattern3(player),
            },
            {
                nextState: END_SEQUENCE_STATE.PATTERN1,
                labelKey: 'pattern1',
                message: 'Outer ring clear',
                icon: 'textures/blocks/barrier',
                run: (player) => this.runEndPattern1(player),
            },
            {
                nextState: END_SEQUENCE_STATE.COOLDOWN,
                labelKey: 'cooldown',
                message: 'Waiting to continue',
                icon: 'textures/blocks/glass_blue',
                run: () => {},
            },
            {
                nextState: END_SEQUENCE_STATE.PATTERN2,
                labelKey: 'pattern2',
                message: 'Inner ring clear',
                icon: 'textures/blocks/diamond_ore',
                run: (player) => this.runEndPattern2(player),
            },
            {
                nextState: END_SEQUENCE_STATE.COMPLETED,
                labelKey: 'completed',
                message: 'Finished',
                icon: 'textures/blocks/emerald_block',
                run: () => {},
            },
        ];
        return END_SEQUENCE_STEPS[state] ?? null;
    }

    getEndSequenceLabel(uhcTick, state, startTick, hasPendingWork) {
        const elapsed = startTick === -1 ? 0 : uhcTick - startTick;
        const remTime = Math.max(0, 100 - elapsed);

        switch (state) {
            case END_SEQUENCE_STATE.INITIAL_WAIT:
                return `Starting in ${remTime}s`;
            case END_SEQUENCE_STATE.PATTERN3:
                return hasPendingWork ? `Filling Nether Wall` : `Nether Wall Done`;
            case END_SEQUENCE_STATE.PATTERN1:
                return hasPendingWork ? `Clearing Outer Ring` : `Outer Ring Done`;
            case END_SEQUENCE_STATE.PATTERN2:
                return hasPendingWork ? `Clearing Inner Ring` : `Inner Ring Done`;
            case END_SEQUENCE_STATE.COOLDOWN:
                return `Cooldown ${remTime}s`;
            case END_SEQUENCE_STATE.COMPLETED:
                return 'Game Over';
            default:
                return 'Standby';
        }
    }

    runEndPattern3(player) {
        if (!player?.isValid) return;
        const dim = player.dimension;
        const startY = ~~player.location.y - 1;
        const pattern = this.PATTERN_3_TASK;
        for (let y = startY; y >= util.WORLD_MIN_Y; y--) {
            for (let i = 0; i < pattern.segments.length; i++) {
                patternEnqueue.enqueuePatternSegment(dim, pattern.segments[i], y, y, pattern.mode, util.DOWNWARD_Y, { randomize: true });
            }
        }
    }

    runEndPattern1(player) {
        if (this.pattern1Queued) return;
        if (!player?.isValid) return;
        this.pattern1Queued = true;
        const dim = player.dimension;
        const pattern = this.PATTERN_1_TASK;
        for (let y = util.WORLD_MAX_Y; y >= util.WORLD_MIN_Y; y--) {
            for (let i = 0; i < pattern.segments.length; i++) {
                patternEnqueue.enqueuePatternSegment(dim, pattern.segments[i], y, y, pattern.mode, util.DOWNWARD_Y, pattern.fillOptions);
            }
        }
    }

    runEndPattern2(player) {
        if (this.pattern2Queued) return;
        if (!player?.isValid) return;
        this.pattern2Queued = true;
        const dim = player.dimension;
        const pattern = this.PATTERN_2_TASK;
        for (let y = util.WORLD_MIN_Y; y <= util.WORLD_MAX_Y; y++) {
            for (let i = 0; i < pattern.segments.length; i++) {
                patternEnqueue.enqueuePatternSegment(dim, pattern.segments[i], y, y, pattern.mode, util.UPWARD_Y, pattern.fillOptions);
            }
        }
    }

    resetPatternFlags() {
        this.pattern1Queued = false;
        this.pattern2Queued = false;
    }
}

export default new BlockFillerEndSequence();
