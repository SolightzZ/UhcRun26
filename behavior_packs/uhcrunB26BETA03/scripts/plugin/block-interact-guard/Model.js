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
    BLOCK_DENYLIST = new Set([
        'minecraft:cartography_table',
        'minecraft:brewing_stand',
        'minecraft:furnace',
        'minecraft:blast_furnace',
        'minecraft:grindstone',
        'minecraft:smithing_table',
        'minecraft:shulker_box',
        'minecraft:hopper',
        'minecraft:flower_pot',
        'minecraft:smoker',
        'minecraft:respawn_anchor',
        'minecraft:barrel',
        'minecraft:composter',
    ]);

    SPECTATOR_DENYLIST = new Set(['minecraft:chest', 'minecraft:trapped_chest', 'minecraft:dispenser', 'minecraft:dropper', 'minecraft:chiseled_bookshelf']);

    DOOR_KEYWORDS = ['gate', 'trapdoor', 'candle', 'decorated_pot', 'crafter'];
    DOOR_REGEX = new RegExp(this.DOOR_KEYWORDS.join('|'));

    doorLikeCache = new LRUMap(128);

    SHULKER_SOUNDS = ['mob.shulker.shoot', 'firework.blast', 'firework.large_blast', 'firework.twinkle'];
    shulkerSoundIdx = 0;
}

export default new Model();
