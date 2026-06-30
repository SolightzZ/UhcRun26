import { system } from '@minecraft/server';
import { getOverworld, TEX_BARRIER } from '../../shared/Util.js';
import { END_SEQUENCE_STATE } from './BlockFillerConstants.js';
import patternEnqueue from './BlockFillerPatternEnqueue.js';
import util from './BlockFillerUtil.js';

//จัดการ end sequence ของ border: pattern เคลียร์วงแหวนรอบนอก/ชั้นใน และวางกำแพง Nether
class BlockFillerEndSequence {
   PATTERN_1_TASK;
   PATTERN_2_TASK;
   PATTERN_3_TASK;
   pattern1Queued = false;
   pattern2Queued = false;
   pattern3Queued = false;

   setPatternTasks(p1, p2, p3) {
      this.PATTERN_1_TASK = p1;
      this.PATTERN_2_TASK = p2;
      this.PATTERN_3_TASK = p3;
   }

   // เช็คว่าถึงเวลาขึ้นสถานะถัดไปของ end sequence หรือยัง
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
            icon: TEX_BARRIER,
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

   // วางกำแพง Nether brick (pattern 3)
   runEndPattern3(player) {
      if (this.pattern3Queued) return;
      if (!player?.isValid) return;

      this.pattern3Queued = true;

      const dim = getOverworld();
      const startY = ~~player.location.y - 1;
      const pattern = this.PATTERN_3_TASK;
      let y = startY;
      let stopped = false;
      const LAYERS_PER_TICK = 10;

      const feedFn = () => {
         if (!player?.isValid || stopped) {
            stopped = true;
            return;
         }

         let layersFed = 0;

         while (y >= util.WORLD_MIN_Y && layersFed < LAYERS_PER_TICK) {
            for (let i = 0; i < pattern.segments.length; i++) {
               patternEnqueue.enqueuePatternSegment(
                  dim,
                  pattern.segments[i],
                  y,
                  y,
                  pattern.mode,
                  util.DOWNWARD_Y,
                  {},
               );
            }

            y--;
            
            layersFed++;
         }
         if (y >= util.WORLD_MIN_Y) {
            system.runTimeout(feedFn, 1);
         }
      };

      system.runTimeout(feedFn, 1);
   }

   // เคลียร์วงแหวนรอบนอก (pattern 1 จากบนลงล่าง)
   runEndPattern1(player) {
      if (this.pattern1Queued) return;
      if (!player?.isValid) return;
      this.pattern1Queued = true;

      const dim = player.dimension;
      const pattern = this.PATTERN_1_TASK;
      let y = util.WORLD_MAX_Y;
      let stopped = false;
      const LAYERS_PER_TICK = 5;

      const feedFn = () => {
         if (!player?.isValid || stopped) {
            stopped = true;
            return;
         }
         let layersFed = 0;
         while (y >= util.WORLD_MIN_Y && layersFed < LAYERS_PER_TICK) {
            for (let i = 0; i < pattern.segments.length; i++) {
               patternEnqueue.enqueuePatternSegment(
                  dim,
                  pattern.segments[i],
                  y,
                  y,
                  pattern.mode,
                  util.DOWNWARD_Y,
                  pattern.fillOptions,
               );
            }
            y--;
            layersFed++;
         }
         if (y >= util.WORLD_MIN_Y) {
            system.runTimeout(feedFn, 1);
         }
      };

      system.runTimeout(feedFn, 1);
   }

   // เคลียร์วงแหวนชั้นใน (pattern 2 จากล่างขึ้นบน)
   runEndPattern2(player) {
      if (this.pattern2Queued) return;
      if (!player?.isValid) return;
      this.pattern2Queued = true;

      const dim = player.dimension;
      const pattern = this.PATTERN_2_TASK;
      let y = util.WORLD_MIN_Y;
      let stopped = false;
      const LAYERS_PER_TICK = 10;

      const feedFn = () => {
         if (!player?.isValid || stopped) {
            stopped = true;
            return;
         }
         let layersFed = 0;
         while (y <= util.WORLD_MAX_Y && layersFed < LAYERS_PER_TICK) {
            for (let i = 0; i < pattern.segments.length; i++) {
               patternEnqueue.enqueuePatternSegment(
                  dim,
                  pattern.segments[i],
                  y,
                  y,
                  pattern.mode,
                  util.UPWARD_Y,
                  pattern.fillOptions,
               );
            }
            y++;
            layersFed++;
         }
         if (y <= util.WORLD_MAX_Y) {
            system.runTimeout(feedFn, 1);
         }
      };

      system.runTimeout(feedFn, 1);
   }

   resetPatternFlags() {
      this.pattern1Queued = false;
      this.pattern2Queued = false;
      this.pattern3Queued = false;
   }
}

export default new BlockFillerEndSequence();
