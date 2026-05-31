import { MODE } from './BlockFillerUtil.js';
import endSequence from './BlockFiller_EndSequence.js';
import fillQueue from './BlockFiller_FillQueue.js';
import patternEnqueue from './BlockFiller_PatternEnqueue.js';
import taskBuilder from './BlockFiller_TaskBuilder.js';
import util from './BlockFiller_Util.js';

class BlockFiller {
    constructor() {
        endSequence.setPatternTasks(
            taskBuilder.createPatternTask(
                'pattern_1',
                MODE.CLEAR,
                [
                    taskBuilder.createPatternSegment('top', -16, 9, 16, 16),
                    taskBuilder.createPatternSegment('right', 9, -8, 16, 8),
                    taskBuilder.createPatternSegment('bottom', -16, -16, 16, -9),
                    taskBuilder.createPatternSegment('left', -16, -8, -9, 8),
                ],
                { useRotation: false, delay: 1, startTopY: util.WORLD_MAX_Y },
            ),
            taskBuilder.createPatternTask(
                'pattern_2',
                MODE.CLEAR,
                [
                    taskBuilder.createPatternSegment('top', -8, 2, 8, 8),
                    taskBuilder.createPatternSegment('bottom', -8, -8, 8, -3),
                    taskBuilder.createPatternSegment('right', 2, -2, 8, 1),
                    taskBuilder.createPatternSegment('left', -8, -2, -3, 1),
                ],
                { useRotation: false, delay: 1, startTopY: util.WORLD_MAX_Y },
            ),
            taskBuilder.createPatternTask('pattern_3', MODE.NETHER, [
                taskBuilder.createPatternSegment('top', -17, 17, 17, 17),
                taskBuilder.createPatternSegment('right', 17, -17, 17, 17),
                taskBuilder.createPatternSegment('bottom', -17, -17, 17, -17),
                taskBuilder.createPatternSegment('left', -17, -17, -17, 17),
            ]),
        );
    }

    mainTick() {
        taskBuilder.resetChunkCache();

        let processedThisTick = 0;

        try {
            processedThisTick += fillQueue.processFillQueue();
            fillQueue.processRetryQueue();
            patternEnqueue.processLayeredTasks();
            patternEnqueue.cleanupDeadTasks();
            fillQueue.updateMetrics(processedThisTick);
        } catch (e) {
            console.error('[BlockFiller] mainTick error:', e);
            this.fillReset();
        }
    }

    fillReset() {
        fillQueue.resetQueue();
        patternEnqueue.resetActiveTasks();
        endSequence.resetPatternFlags();
        util.resetUtilState();
    }

    getAdaptiveBatchSize() {
        return fillQueue.getAdaptiveBatchSize();
    }
    fillAddTask(task, blockCount) {
        return fillQueue.fillAddTask(task, blockCount);
    }
    fillIsIdle() {
        return fillQueue.fillIsIdle();
    }
    fillHasPendingWork() {
        return fillQueue.fillHasPendingWork();
    }
    fillEstimateRemainingSeconds() {
        return fillQueue.fillEstimateRemainingSeconds();
    }
    getRuntimeMetrics() {
        return fillQueue.runtimeMetrics;
    }

    shouldAdvanceEndSequence(uhcTick, state, startTick, hasPendingWork) {
        return endSequence.shouldAdvanceEndSequence(uhcTick, state, startTick, hasPendingWork);
    }
    getEndSequenceStep(state) {
        return endSequence.getEndSequenceStep(state);
    }
    getEndSequenceLabel(uhcTick, state, startTick, hasPendingWork) {
        return endSequence.getEndSequenceLabel(uhcTick, state, startTick, hasPendingWork);
    }
    runEndPattern3(player) {
        return endSequence.runEndPattern3(player);
    }
    runEndPattern1(player) {
        return endSequence.runEndPattern1(player);
    }
    runEndPattern2(player) {
        return endSequence.runEndPattern2(player);
    }

    enqueuePatternSegment(dim, segment, startY, endY, mode, yDirection, fillOptions) {
        return patternEnqueue.enqueuePatternSegment(dim, segment, startY, endY, mode, yDirection, fillOptions);
    }
    enqueuePatternSegments(dim, y, patternTask) {
        return patternEnqueue.enqueuePatternSegments(dim, y, patternTask);
    }
    enqueueRotatedPatternSegments(dim, y, patternTask, rotationIndex) {
        return patternEnqueue.enqueueRotatedPatternSegments(dim, y, patternTask, rotationIndex);
    }
    registerLayeredTask(player, patternTask) {
        return patternEnqueue.registerLayeredTask(player, patternTask);
    }
}

export default new BlockFiller();
