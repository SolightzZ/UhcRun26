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
            if (val && typeof val === 'object' && typeof val.lastWarnTick === 'number') {
                if (currentTick - val.lastWarnTick > this._ttl) {
                    // Also check if the most recent hit is stale
                    if (val.count > 0) {
                        const newestIdx = (val.head - 1 + val.BUF_SIZE) % val.BUF_SIZE;
                        const newestHit = val.buf[newestIdx];
                        if (currentTick - newestHit > this._ttl) {
                            this._m.delete(key);
                        }
                    } else {
                        this._m.delete(key);
                    }
                }
            }
        }
    }
}

class Model {
    MAX_CPS = 18; // Soft warning limit
    HARD_LIMIT = 24; // Hard kick limit
    WINDOW_TICKS = 20;
    BUF_SIZE = this.HARD_LIMIT;

    playerState = new LRUMap(Infinity, 200);

    createPlayerData = () => ({
        buf: new Int32Array(this.BUF_SIZE),
        head: 0,
        count: 0,
        lastWarnTick: 0,
        BUF_SIZE: this.BUF_SIZE,
    });
}

export default new Model();
