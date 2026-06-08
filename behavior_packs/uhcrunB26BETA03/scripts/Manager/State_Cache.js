export const GlobalPlayerCaches = new Map();

export function ensureGPC(id) {
    let cache = GlobalPlayerCaches.get(id);
    if (cache) return cache;
    cache = {};
    GlobalPlayerCaches.set(id, cache);
    return cache;
}

export function createCacheProxy(key) {
    let size = 0;
    const proxy = {
        get(id) {
            return GlobalPlayerCaches.get(id)?.[key];
        },
        set(id, val) {
            const cache = ensureGPC(id);
            const exists = cache[key] !== undefined;
            cache[key] = val;
            if (!exists) size++;
            return proxy;
        },
        delete(id) {
            const cache = GlobalPlayerCaches.get(id);
            if (!cache || cache[key] === undefined) return false;
            delete cache[key];
            size--;
            return true;
        },
        has(id) {
            return GlobalPlayerCaches.get(id)?.[key] !== undefined;
        },
        *entries() {
            const gEntries = [...GlobalPlayerCaches.entries()];
            for (let e = 0, eLen = gEntries.length; e < eLen; e++) {
                const [id, cache] = gEntries[e];
                if (!cache) continue;
                const value = cache[key];
                if (value === undefined) continue;
                yield [id, value];
            }
        },
        clear() {
            const gValues = [...GlobalPlayerCaches.values()];
            for (let v = 0, vLen = gValues.length; v < vLen; v++) {
                const cache = gValues[v];
                if (cache && cache[key] !== undefined) {
                    delete cache[key];
                }
            }
            size = 0;
        },
        get size() {
            return size;
        },
    };
    return proxy;
}

export const playerTeamCache = createCacheProxy('teamId');
export const hitRegistry = createCacheProxy('hit');
export const multiKill = createCacheProxy('multiKill');
export const killStreak = createCacheProxy('killStreak');
export const playerCache = createCacheProxy('playerRef');

export const combatAnnouncer = Object.freeze({
    multiKill,
    killStreak,
});

export const uhcPlayerIds = {
    _size: 0,
    has(id) {
        return GlobalPlayerCaches.get(id)?.isUhc === true;
    },
    add(id) {
        const cache = ensureGPC(id);
        if (cache.isUhc === true) return this;
        cache.isUhc = true;
        this._size++;
        return this;
    },
    delete(id) {
        const cache = GlobalPlayerCaches.get(id);
        if (!cache || cache.isUhc !== true) return false;
        delete cache.isUhc;
        this._size--;
        return true;
    },
    clear() {
        const gValues = [...GlobalPlayerCaches.values()];
        for (let v = 0, vLen = gValues.length; v < vLen; v++) {
            const c = gValues[v];
            if (c.isUhc === true) {
                delete c.isUhc;
            }
        }
        this._size = 0;
    },
    get size() {
        return this._size;
    },
};

export const isUHC = (entity) => entity && uhcPlayerIds.has(entity.id);

export let allPlayersCache = [];
export let uhcPlayersCache = [];
export let allPlayersCacheIds = new Set();
