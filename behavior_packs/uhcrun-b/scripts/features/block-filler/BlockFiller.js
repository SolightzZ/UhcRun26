import { logError } from '../../shared/Util.js';
import { MODE } from './BlockFillerConstants.js';
import BlockFillerEndSequence from './BlockFillerEndSequence.js';
import BlockFillerFillQueue from './BlockFillerFillQueue.js';
import BlockFillerPatternEnqueue from './BlockFillerPatternEnqueue.js';
import BlockFillerTaskBuilder from './BlockFillerTaskBuilder.js';
import BlockFillerUtil from './BlockFillerUtil.js';

class BlockFiller {
   constructor() {
      BlockFillerFillQueue.setMainTickHandler(() => this.mainTick());
      BlockFillerEndSequence.setPatternTasks(
         BlockFillerTaskBuilder.createPatternTask(
            'pattern_1',
            MODE.CLEAR,
            [
               BlockFillerTaskBuilder.createPatternSegment('top', -16, 9, 16, 16),
               BlockFillerTaskBuilder.createPatternSegment('right', 9, -8, 16, 8),
               BlockFillerTaskBuilder.createPatternSegment('bottom', -16, -16, 16, -9),
               BlockFillerTaskBuilder.createPatternSegment('left', -16, -8, -9, 8),
            ],
            { useRotation: false, delay: 1, startTopY: BlockFillerUtil.WORLD_MAX_Y },
         ),
         BlockFillerTaskBuilder.createPatternTask(
            'pattern_2',
            MODE.CLEAR,
            [
               BlockFillerTaskBuilder.createPatternSegment('top', -8, 2, 8, 8),
               BlockFillerTaskBuilder.createPatternSegment('bottom', -8, -8, 8, -3),
               BlockFillerTaskBuilder.createPatternSegment('right', 2, -2, 8, 1),
               BlockFillerTaskBuilder.createPatternSegment('left', -8, -2, -3, 1),
            ],
            { useRotation: false, delay: 1, startTopY: BlockFillerUtil.WORLD_MAX_Y },
         ),
         BlockFillerTaskBuilder.createPatternTask('pattern_3', MODE.NETHER, [
            BlockFillerTaskBuilder.createPatternSegment('top', -17, 17, 17, 17),
            BlockFillerTaskBuilder.createPatternSegment('right', 17, -17, 17, 17),
            BlockFillerTaskBuilder.createPatternSegment('bottom', -17, -17, 17, -17),
            BlockFillerTaskBuilder.createPatternSegment('left', -17, -17, -17, 17),
         ]),
      );
   }

   mainTick() {
      BlockFillerTaskBuilder.resetChunkCache();

      try {
         BlockFillerFillQueue.processFillQueue();
         BlockFillerFillQueue.processRetryQueue();
         BlockFillerPatternEnqueue.processLayeredTasks();
         BlockFillerPatternEnqueue.cleanupDeadTasks();

         if (
            BlockFillerFillQueue.TASK_QUEUE.length - BlockFillerFillQueue.queueHead === 0 &&
            BlockFillerFillQueue.RETRY_QUEUE.length === 0 &&
            BlockFillerPatternEnqueue.ACTIVE_LAYERED_TASKS.length === 0
         ) {
            BlockFillerFillQueue.stopFillLoop();
         } else {
            BlockFillerFillQueue._rescheduleIfNeeded();
         }
      } catch (error) {
         logError('BlockFiller', 'mainTick error', error);
         this.fillReset();
      }
   }

   fillReset() {
      BlockFillerFillQueue.resetQueue();
      BlockFillerPatternEnqueue.resetActiveTasks();
      BlockFillerEndSequence.resetPatternFlags();
      BlockFillerUtil.resetUtilState();
   }

   setIsEndgameHandler(handler) {
      BlockFillerFillQueue.setIsEndgameHandler(handler);
   }
   fillAddTask(task, blockCount) {
      return BlockFillerFillQueue.fillAddTask(task, blockCount);
   }
   fillIsIdle() {
      return BlockFillerFillQueue.fillIsIdle();
   }
   fillHasPendingWork() {
      return BlockFillerFillQueue.fillHasPendingWork();
   }

   shouldAdvanceEndSequence(uhcTick, state, startTick, hasPendingWork) {
      return BlockFillerEndSequence.shouldAdvanceEndSequence(uhcTick, state, startTick, hasPendingWork);
   }
   getEndSequenceStep(state) {
      return BlockFillerEndSequence.getEndSequenceStep(state);
   }
   getEndSequenceLabel(uhcTick, state, startTick, hasPendingWork) {
      return BlockFillerEndSequence.getEndSequenceLabel(uhcTick, state, startTick, hasPendingWork);
   }
   runEndPattern3(player) {
      return BlockFillerEndSequence.runEndPattern3(player);
   }
   runEndPattern1(player) {
      return BlockFillerEndSequence.runEndPattern1(player);
   }
   runEndPattern2(player) {
      return BlockFillerEndSequence.runEndPattern2(player);
   }

   enqueuePatternSegment(dim, segment, startY, endY, mode, yDirection, fillOptions) {
      return BlockFillerPatternEnqueue.enqueuePatternSegment(dim, segment, startY, endY, mode, yDirection, fillOptions);
   }
   enqueuePatternSegments(dim, y, patternTask) {
      return BlockFillerPatternEnqueue.enqueuePatternSegments(dim, y, patternTask);
   }
   enqueueRotatedPatternSegments(dim, y, patternTask, rotationIndex) {
      return BlockFillerPatternEnqueue.enqueueRotatedPatternSegments(dim, y, patternTask, rotationIndex);
   }
   registerLayeredTask(player, patternTask) {
      return BlockFillerPatternEnqueue.registerLayeredTask(player, patternTask);
   }
}

export default new BlockFiller();
