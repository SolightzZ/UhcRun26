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
    TNT = 'minecraft:tnt';
    TNT_SPAWN_OFFSET = { x: 0.5, y: 0.4, z: 0.5 };
    TNT_COOLDOWN_TICKS = 2;
    TNT_GLOBAL_PER_TICK = 8;

    cdMap = new LRUMap(54);
    tntGlobalTick = -1;
    tntGlobalCount = 0;
}

export default new Model();
