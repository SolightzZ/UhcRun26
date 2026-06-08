import { BlockPermutation } from '@minecraft/server';

class LRUMap {
    constructor(maxSize = Infinity) {
        this._m = new Map();
        this._max = maxSize;
    }

    get(key) {
        if (!this._m.has(key)) return undefined;
        const val = this._m.get(key);
        this._m.delete(key);
        this._m.set(key, val);
        return val;
    }

    set(key, val) {
        if (this._m.has(key)) {
            this._m.delete(key);
        }
        this._m.set(key, val);
        if (this._m.size > this._max) {
            const oldest = this._m.keys().next().value;
            this._m.delete(oldest);
        }
    }

    delete(key) { this._m.delete(key); }
    has(key) { return this._m.has(key); }
    get size() { return this._m.size; }
    clear() { this._m.clear(); }
}

class Model {
    CONFIG = Object.freeze({
        MAX_LOGS: 16,
        MAX_LEAVES: 64,
        CANOPY_RADIUS: 3,
        LEAF_SCAN_PAD: 4,
        APPLE_CHANCE: 0.02,
        COOLDOWN_TICKS: 5,
        SCAN_BLOCK_CAP: 400,
        BREAK_PER_TICK: 6,
        LEAF_BREAK_PER_TICK: 18,
        MAX_CONCURRENT_JOBS: 4,
        MAX_QUEUE_SIZE: 50,
        MAX_JOBS_PER_PLAYER: 3,
        MAX_APPLES: 3,
    });

    WOOD_MAP = Object.freeze({
        'minecraft:oak_log': 'minecraft:oak_leaves',
        'minecraft:birch_log': 'minecraft:birch_leaves',
        'minecraft:spruce_log': 'minecraft:spruce_leaves',
        'minecraft:jungle_log': 'minecraft:jungle_leaves',
        'minecraft:acacia_log': 'minecraft:acacia_leaves',
        'minecraft:dark_oak_log': 'minecraft:dark_oak_leaves',
        'minecraft:mangrove_log': 'minecraft:mangrove_leaves',
        'minecraft:cherry_log': 'minecraft:cherry_leaves',
        'minecraft:pale_oak_log': 'minecraft:pale_oak_leaves',
    });

    LOG_SET = new Set(Object.keys(this.WOOD_MAP));
    AXE_SET = new Set(['minecraft:wooden_axe', 'minecraft:stone_axe', 'minecraft:iron_axe', 'minecraft:golden_axe', 'minecraft:diamond_axe', 'minecraft:netherite_axe']);

    NEIGHBOUR_OFFSETS = Object.freeze([1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1]);
    LEAF_SCAN_BATCH_SIZE = 50;
    ITEM_BATCH_THRESHOLD = 8;

    lastFellTick = new LRUMap(50);
    playerJobCount = new LRUMap(50);
    lastEnqueueTick = new LRUMap(50);
    jobQueue = [];
    activeJobs = 0;
    schedulerPending = false;
    lastScheduledPlayerId = null;
    AIR = null;

    getAir = () => {
        if (!this.AIR) this.AIR = BlockPermutation.resolve('minecraft:air');
        return this.AIR;
    };
}

export default new Model();
