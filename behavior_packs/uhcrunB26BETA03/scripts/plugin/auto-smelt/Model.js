class LRUMap {
    constructor(maxSize = Infinity, ttlTicks = 0) {
        this._m = new Map();
        this._max = maxSize;
        this._ttl = ttlTicks;
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

    cleanup(currentTick) {
        if (this._ttl <= 0) return;
        for (const [key, val] of this._m) {
            const tick = val && typeof val === 'object' ? (val.tick ?? -1) : -1;
            if (tick >= 0 && currentTick - tick > this._ttl) {
                this._m.delete(key);
            }
        }
    }
}

class Model {
    CONFIG = Object.freeze({
        scan: Object.freeze({ itemRadius: 2 }),
        xp: Object.freeze({
            smelt: [1, 4],
            coal: [1, 10],
            copper: [1, 8],
            emerald: [1, 15],
            redstone: [1, 4],
        }),
        chance: Object.freeze({ absorption: 16, lapisBook: 12, premiumBlock: 30 }),
        redstone: Object.freeze({
            healAmount: 2,
            absorptionDuration: 12000,
            get absorptionMinutes() {
                return Math.floor(this.absorptionDuration / 1200);
            },
        }),
        sounds: Object.freeze({ orb: 'random.orb', level: 'random.levelup' }),
        feedback: Object.freeze({
            arrow: Object.freeze({ message: 'Arrow §a+1', texture: 'textures/items/arrow' }),
            book: Object.freeze({ message: 'Book §a+1', texture: 'textures/items/book_normal' }),
            health: Object.freeze({ texture: 'textures/ui/heart_new' }),
            absorption: Object.freeze({ texture: 'textures/ui/absorption_heart' }),
        }),
    });

    ACTION = Object.freeze({
        SMELT: 1,
        SMELT_XP: 2,
        LAPIS: 3,
        GRAVEL: 4,
        REDSTONE: 5,
        EFFECT: 6,
    });

    BLOCK_ACTION_MAP = new Map([
        ['minecraft:iron_ore', this.ACTION.SMELT],
        ['minecraft:deepslate_iron_ore', this.ACTION.SMELT],
        ['minecraft:gold_ore', this.ACTION.SMELT],
        ['minecraft:deepslate_gold_ore', this.ACTION.SMELT],
        ['minecraft:coal_ore', this.ACTION.SMELT_XP],
        ['minecraft:copper_ore', this.ACTION.SMELT_XP],
        ['minecraft:deepslate_copper_ore', this.ACTION.SMELT_XP],
        ['minecraft:emerald_ore', this.ACTION.SMELT_XP],
        ['minecraft:deepslate_emerald_ore', this.ACTION.SMELT_XP],
        ['minecraft:lapis_ore', this.ACTION.LAPIS],
        ['minecraft:deepslate_lapis_ore', this.ACTION.LAPIS],
        ['minecraft:gravel', this.ACTION.GRAVEL],
        ['minecraft:redstone_ore', this.ACTION.REDSTONE],
        ['minecraft:lit_redstone_ore', this.ACTION.REDSTONE],
        ['minecraft:deepslate_redstone_ore', this.ACTION.REDSTONE],
        ['minecraft:lit_deepslate_redstone_ore', this.ACTION.REDSTONE],
        ['minecraft:diamond_ore', this.ACTION.EFFECT],
        ['minecraft:deepslate_diamond_ore', this.ACTION.EFFECT],
        ['minecraft:obsidian', this.ACTION.EFFECT],
    ]);

    PICKAXES = new Set(['minecraft:wooden_pickaxe', 'minecraft:stone_pickaxe', 'minecraft:golden_pickaxe', 'minecraft:iron_pickaxe', 'minecraft:diamond_pickaxe', 'minecraft:netherite_pickaxe']);

    SHOVELS = new Set(['minecraft:wooden_shovel', 'minecraft:stone_shovel', 'minecraft:iron_shovel', 'minecraft:golden_shovel', 'minecraft:diamond_shovel', 'minecraft:netherite_shovel']);

    SOUND_OPTIONS = Object.freeze({
        effect: Object.freeze({ volume: 0.2, pitch: 1.5 }),
        orb: Object.freeze({ volume: 0.4, pitch: 1.5 }),
        level: Object.freeze({ volume: 0.8, pitch: 1.5 }),
    });

    ITEM_TABLE = Object.freeze({
        'minecraft:flint': Object.freeze({ type: 'special', handler: 'flint' }),
        'minecraft:lapis_lazuli': Object.freeze({ type: 'special', handler: 'lapis' }),
        'minecraft:coal': Object.freeze({ type: 'xp', range: this.CONFIG.xp.coal }),
        'minecraft:raw_copper': Object.freeze({ type: 'xp', range: this.CONFIG.xp.copper }),
        'minecraft:emerald': Object.freeze({ type: 'xp', range: this.CONFIG.xp.emerald }),
        'minecraft:raw_iron': Object.freeze({ type: 'smelt', result: 'minecraft:iron_ingot', xp: this.CONFIG.xp.smelt }),
        'minecraft:raw_gold': Object.freeze({ type: 'smelt', result: 'minecraft:gold_ingot', xp: this.CONFIG.xp.smelt }),
        'minecraft:redstone': Object.freeze({ type: 'redstone' }),
    });

    toolCache = new LRUMap(60, 1);
    pendingJobs = new Map();
    scheduledDims = new Set();
    _r2 = this.CONFIG.scan.itemRadius ** 2;
}

export default new Model();
