import { system } from '@minecraft/server';
import bf from './BlockFiller.js';
import taskBuilder from './BlockFiller_TaskBuilder.js';
import util from './BlockFiller_Util';

class BlockFillerPatternEnqueue {
    ACTIVE_LAYERED_TASKS = [];

    enqueuePatternSegment(dim, segment, startY, endY, mode, yDirection = util.UPWARD_Y, fillOptions = {}) {
        const segments = taskBuilder.createFillTask(dim, segment.x1, startY, segment.z1, segment.x2, endY, segment.z2, mode, yDirection, fillOptions);
        if (!segments || segments.length === 0) return;
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (!seg || typeof seg.task !== 'function') continue;
            bf.fillAddTask(seg.task, seg.blockCount);
        }
    }

    enqueuePatternSegments(dim, y, patternTask) {
        const endY = patternTask.fillBottomY ?? y;
        for (let i = 0; i < patternTask.segments.length; i++) {
            this.enqueuePatternSegment(dim, patternTask.segments[i], y, endY, patternTask.mode, patternTask.yDirection, patternTask.fillOptions);
        }
    }

    enqueueRotatedPatternSegments(dim, y, patternTask, rotationIndex) {
        const rotation = patternTask.rotationCache?.[rotationIndex];
        if (!rotation) return;
        for (let i = 0; i < rotation.length; i++) {
            this.enqueuePatternSegment(dim, rotation[i], y, y, patternTask.mode, patternTask.yDirection, patternTask.fillOptions);
        }
    }

    processLayeredTasks() {
        for (let i = this.ACTIVE_LAYERED_TASKS.length - 1; i >= 0; i--) {
            const lt = this.ACTIVE_LAYERED_TASKS[i];
            if (lt.stopped || !lt.player?.isValid) {
                const lastIdx = this.ACTIVE_LAYERED_TASKS.length - 1;
                if (i !== lastIdx) this.ACTIVE_LAYERED_TASKS[i] = this.ACTIVE_LAYERED_TASKS[lastIdx];
                this.ACTIVE_LAYERED_TASKS.pop();
                continue;
            }

            if (system.currentTick % lt.delay !== 0) continue;

            const y = lt.baseY - lt.layer;
            if (y < util.WORLD_MIN_Y) {
                lt.stopped = true;
                continue;
            }

            if (lt.patternTask.rotationCache) {
                this.enqueueRotatedPatternSegments(lt.dim, y, lt.patternTask, lt.rotationIndex);
                lt.rotationIndex = (lt.rotationIndex + 1) & 3;
            } else {
                this.enqueuePatternSegments(lt.dim, y, lt.patternTask);
            }
            lt.layer++;
        }
    }

    registerLayeredTask(player, patternTask) {
        if (!player?.isValid) return;
        for (let i = 0; i < this.ACTIVE_LAYERED_TASKS.length; i++) {
            const t = this.ACTIVE_LAYERED_TASKS[i];
            if (t.player === player && t.patternTask.name === patternTask.name) {
                return;
            }
        }

        const dim = player.dimension;
        const baseY = patternTask.startTopY ?? ~~player.location.y - 1;

        this.ACTIVE_LAYERED_TASKS.push({
            player,
            dim,
            patternTask,
            baseY,
            layer: 0,
            rotationIndex: 0,
            delay: patternTask.delay ?? 20,
            stopped: false,
        });
    }

    cleanupDeadTasks() {
        if (system.currentTick % 100 !== 0) return;
        for (let i = this.ACTIVE_LAYERED_TASKS.length - 1; i >= 0; i--) {
            const lt = this.ACTIVE_LAYERED_TASKS[i];
            if (lt.stopped || !lt.player?.isValid) {
                const lastIdx = this.ACTIVE_LAYERED_TASKS.length - 1;
                if (i !== lastIdx) this.ACTIVE_LAYERED_TASKS[i] = this.ACTIVE_LAYERED_TASKS[lastIdx];
                this.ACTIVE_LAYERED_TASKS.pop();
            }
        }
    }

    resetActiveTasks() {
        this.ACTIVE_LAYERED_TASKS.length = 0;
    }
}

export default new BlockFillerPatternEnqueue();
