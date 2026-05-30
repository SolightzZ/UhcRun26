import { system } from '@minecraft/server';
import bf from './BlockFiller.js';
import util from './BlockFiller_Util';
import { CHECKPOINTS, ctx } from './BorderManager';

class BlockFillerFillQueue {
    TASK_QUEUE = [];
    RETRY_QUEUE = [];
    fillIntervalId = null;
    queueHead = 0;
    pendingBlocks = 0;

    runtimeMetrics = {
        lastProcessedBlocks: 0 | 0,
        activeQueueSize: 0 | 0,
        retryQueueSize: 0 | 0,
        pendingBlocks: 0 | 0,
    };

    MAX_ATTEMPTS = 20;

    processFillQueue() {
        const isEndgame = ctx?.nextShrinkIndex >= CHECKPOINTS?.length;
        if (!isEndgame && system.currentTick % 2 !== 0) return 0;

        const BATCH_SIZE = isEndgame ? util.BATCH_SIZE_ENDGAME : util.BATCH_SIZE_NORMAL;
        let processed = 0;
        let head = this.queueHead;
        const queue = this.TASK_QUEUE;

        while (head < queue.length && processed < BATCH_SIZE) {
            const task = queue[head];

            let result;
            try {
                result = task(BATCH_SIZE - processed);
            } catch {
                head++;
                continue;
            }

            if (result.blocked) {
                this.pushRetry(task, this.normalizeRemaining(result.remaining));
                head++;
                continue;
            }

            const consumed = result.consumed | 0;

            if (consumed > 0) {
                processed += consumed;
                this.pendingBlocks -= consumed;
                if (this.pendingBlocks < 0) this.pendingBlocks = 0;
            }

            if (result.done) head++;
        }

        this.queueHead = head;
        if (this.queueHead > util.COMPACT_THRESHOLD) this.compactQueue();

        return processed;
    }

    canQueueTask(blockCount) {
        if (blockCount > util.MAX_BLOCKS_PER_TASK) return false;
        if (this.TASK_QUEUE.length - this.queueHead >= util.TASK_QUEUE_HARD_CAP) return false;
        if (this.pendingBlocks + blockCount >= util.MAX_PENDING_BLOCKS) return false;
        return true;
    }

    queueTask(task, blockCount) {
        if (typeof task !== 'function') return false;
        if (blockCount <= 0 || !Number.isFinite(blockCount)) return false;

        if (!this.canQueueTask(blockCount)) return false;

        this.TASK_QUEUE.push(task);

        this.pendingBlocks += blockCount;
        if (this.pendingBlocks > util.MAX_PENDING_BLOCKS) {
            this.pendingBlocks = util.MAX_PENDING_BLOCKS;
        }

        this.startFillLoopIfNeeded();
        return true;
    }

    compactQueue() {
        this.TASK_QUEUE.splice(0, this.queueHead);
        this.queueHead = 0;
    }

    fillAddTask(task, blockCount) {
        if (typeof task !== 'function') return;
        if (blockCount <= 0 || !Number.isFinite(blockCount)) return;

        if (!this.queueTask(task, blockCount)) {
            this.pushRetry(task, blockCount);
        }
    }

    normalizeRemaining(value) {
        if (!Number.isFinite(value)) return 0;
        if (value <= 0) return 0;
        return value | 0;
    }

    pushRetry(task, blockCount) {
        if (typeof task !== 'function') return;
        if (blockCount <= 0 || !Number.isFinite(blockCount)) return;

        const headroom = util.MAX_PENDING_BLOCKS - this.pendingBlocks;
        const clampedCount = Math.min(blockCount, Math.max(0, headroom));

        if (this.RETRY_QUEUE.length >= util.RETRY_QUEUE_LIMIT) {
            const removed = this.RETRY_QUEUE.shift();
            if (removed) {
                this.pendingBlocks -= removed.blockCount;
                if (this.pendingBlocks < 0) this.pendingBlocks = 0;
            }
        }

        if (clampedCount <= 0) return;

        this.RETRY_QUEUE.push({
            task,
            blockCount: clampedCount,
            nextTryTick: system.currentTick + util.RETRY_BASE_DELAY_TICKS,
            attempts: 0,
        });
    }

    processRetryQueue() {
        if (this.RETRY_QUEUE.length === 0) return;

        let i = 0;
        let processed = 0;
        const now = system.currentTick;

        while (i < this.RETRY_QUEUE.length && processed < 35) {
            const entry = this.RETRY_QUEUE[i];

            if (entry.nextTryTick > now) {
                i++;
                continue;
            }

            if (entry.attempts >= this.MAX_ATTEMPTS) {
                this.pendingBlocks -= entry.blockCount;
                if (this.pendingBlocks < 0) this.pendingBlocks = 0;
                this.RETRY_QUEUE[i] = this.RETRY_QUEUE[this.RETRY_QUEUE.length - 1];
                this.RETRY_QUEUE.pop();
                continue;
            }

            if (this.canQueueTask(entry.blockCount) && this.queueTask(entry.task, entry.blockCount)) {
                this.RETRY_QUEUE[i] = this.RETRY_QUEUE[this.RETRY_QUEUE.length - 1];
                this.RETRY_QUEUE.pop();
                processed++;
                continue;
            }

            entry.attempts = (entry.attempts + 1) | 0;
            entry.nextTryTick = now + Math.min(util.RETRY_BASE_DELAY_TICKS * entry.attempts, 60);

            i++;
        }
    }

    startFillLoopIfNeeded() {
        if (this.fillIntervalId !== null) return;

        this.fillIntervalId = system.runInterval(() => {
            if (!this.fillIntervalId) return;
            bf.mainTick();
        }, util.FILL_INTERVAL_TICKS);
    }

    getAdaptiveBatchSize() {
        return ctx?.nextShrinkIndex >= CHECKPOINTS?.length ? util.BATCH_SIZE_ENDGAME : util.BATCH_SIZE_NORMAL;
    }

    fillIsIdle() {
        return this.fillIntervalId === null;
    }

    fillHasPendingWork() {
        return !this.fillIsIdle() && this.pendingBlocks > 0;
    }

    fillEstimateRemainingSeconds() {
        if (this.pendingBlocks <= 0 || this.fillIsIdle()) return 0;
        const batchSize = this.getAdaptiveBatchSize();

        const isEndgame = ctx?.nextShrinkIndex >= CHECKPOINTS?.length;
        const fillsPerSecond = isEndgame ? util.TICKS_PER_SECOND : util.TICKS_PER_SECOND / 2;
        return Math.max(1, Math.ceil(this.pendingBlocks / (batchSize * fillsPerSecond)));
    }

    resetQueue() {
        if (this.fillIntervalId !== null) {
            system.clearRun(this.fillIntervalId);
            this.fillIntervalId = null;
        }

        this.TASK_QUEUE.length = 0;
        this.RETRY_QUEUE.length = 0;
        this.queueHead = 0;
        this.pendingBlocks = 0;
    }

    updateMetrics(processed) {
        if ((system.currentTick & 3) === 0) {
            this.runtimeMetrics.lastProcessedBlocks = processed | 0;
            this.runtimeMetrics.activeQueueSize = (this.TASK_QUEUE.length - this.queueHead) | 0;
            this.runtimeMetrics.retryQueueSize = this.RETRY_QUEUE.length | 0;
            this.runtimeMetrics.pendingBlocks = this.pendingBlocks | 0;
        }
    }
}

export default new BlockFillerFillQueue();
