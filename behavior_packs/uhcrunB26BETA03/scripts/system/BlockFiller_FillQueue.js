import { system } from "@minecraft/server";
import util from "./BlockFiller_Util.js";

class BlockFillerFillQueue {
  TASK_QUEUE = [];
  RETRY_QUEUE = [];
  fillIntervalId = null;
  queueHead = 0;
  pendingBlocks = 0;

  MAX_ATTEMPTS = 20;
  mainTickHandler = null;
  isEndgameHandler = () => false;

  setMainTickHandler(handler) {
    this.mainTickHandler = typeof handler === "function" ? handler : null;
  }

  setIsEndgameHandler(handler) {
    this.isEndgameHandler =
      typeof handler === "function" ? handler : () => false;
  }

  processFillQueue() {
    const isEndgame = this.isEndgameHandler();
    if (!isEndgame && system.currentTick % 2 !== 0) return 0;

    const BATCH_SIZE = isEndgame
      ? util.BATCH_SIZE_ENDGAME
      : util.BATCH_SIZE_NORMAL;
    let processed = 0;
    let head = this.queueHead;
    const queue = this.TASK_QUEUE;

    while (head < queue.length && processed < BATCH_SIZE) {
      const task = queue[head];

      let result;
      try {
        result = task(BATCH_SIZE - processed);
      } catch (e) {
        console.warn("[FillQueue] Task execution failed:", e);
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
    if (this.TASK_QUEUE.length - this.queueHead >= util.TASK_QUEUE_HARD_CAP)
      return false;
    if (this.pendingBlocks + blockCount >= util.MAX_PENDING_BLOCKS)
      return false;
    return true;
  }

  queueTask(task, blockCount) {
    if (typeof task !== "function") return false;
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
    if (typeof task !== "function") return;
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
    if (typeof task !== "function") return;
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

      if (
        this.canQueueTask(entry.blockCount) &&
        this.queueTask(entry.task, entry.blockCount)
      ) {
        this.RETRY_QUEUE[i] = this.RETRY_QUEUE[this.RETRY_QUEUE.length - 1];
        this.RETRY_QUEUE.pop();
        processed++;
        continue;
      }

      entry.attempts = (entry.attempts + 1) | 0;
      entry.nextTryTick =
        now + Math.min(util.RETRY_BASE_DELAY_TICKS * entry.attempts, 60);

      i++;
    }
  }

  startFillLoopIfNeeded() {
    if (this.fillIntervalId !== null) return;

    // Use runTimeout + reschedule instead of persistent runInterval
    // This saves CPU when the queue is empty and stops automatically
    const tick = () => {
      if (!this.fillIntervalId) return;
      this.fillIntervalId = null; // Clear before handler so _rescheduleIfNeeded works
      this.mainTickHandler?.();
    };

    this.fillIntervalId = system.runTimeout(tick, util.FILL_INTERVAL_TICKS);
  }

  _rescheduleIfNeeded() {
    if (this.fillIntervalId !== null) return;
    if (
      this.TASK_QUEUE.length - this.queueHead === 0 &&
      this.RETRY_QUEUE.length === 0
    )
      return;
    const tick = () => {
      if (!this.fillIntervalId) return;
      this.fillIntervalId = null;
      this.mainTickHandler?.();
    };
    this.fillIntervalId = system.runTimeout(tick, util.FILL_INTERVAL_TICKS);
  }

  getAdaptiveBatchSize() {
    return this.isEndgameHandler()
      ? util.BATCH_SIZE_ENDGAME
      : util.BATCH_SIZE_NORMAL;
  }

  fillIsIdle() {
    return this.fillIntervalId === null;
  }

  fillHasPendingWork() {
    return !this.fillIsIdle() && this.pendingBlocks > 0;
  }

  stopFillLoop() {
    if (this.fillIntervalId !== null) {
      system.clearRun(this.fillIntervalId);
      this.fillIntervalId = null;
    }
  }

  resetQueue() {
    this.stopFillLoop();

    this.TASK_QUEUE.length = 0;
    this.RETRY_QUEUE.length = 0;
    this.queueHead = 0;
    this.pendingBlocks = 0;
  }
}

export default new BlockFillerFillQueue();
