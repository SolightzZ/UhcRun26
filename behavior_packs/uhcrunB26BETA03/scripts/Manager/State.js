import { system } from '@minecraft/server';
import { CONFIG, TEAMS } from './UtilTeamManager.js';

export { CONFIG, TEAMS };

export const TEAM_LOOKUP = new Map(TEAMS.map((t) => [t.id, t]));
export const TEAM_INDEX_MAP = new Map(TEAMS.map((t, i) => [t.id, i]));

export const teamCounts = new Map();
export const teamPlayerIndex = new Map();

for (const t of TEAMS) {
    teamPlayerIndex.set(t.id, new Set());
    teamCounts.set(t.id, 0);
}

export let isGameRunning = false;
export function setGameRunningState(state) {
    isGameRunning = state;
}

export const KD = Object.freeze({
    SCORE_HISTORY_OBJECTIVE: 'kdhistory',
    HIT_TIMEOUT_SECONDS: 8,
});

export const HIT_TIMEOUT_TICKS = 20 * KD.HIT_TIMEOUT_SECONDS;
export const MULTI_TIMEOUT_TICKS = 20 * 16;

export const teamStats = new Map();
export const playerStats = new Map();
export const deathLocation = new Map();

export const REVIVE_ITEM_ID = 'minecraft:player_head';
export const REVIVE_DURATION_TICKS = 30 * 20;
export const REVIVE_COOLDOWN_TICKS = 30 * 20;
export const REVIVE_CANCEL_MOVE_DISTANCE = 1;
export const REVIVE_ACTIONBAR_INTERVAL = 10;

export const playerTeamCache = createCacheProxy('teamId');
export const hitRegistry = createCacheProxy('hit');
export const multiKill = createCacheProxy('multiKill');
export const killStreak = createCacheProxy('killStreak');
export const playerCache = createCacheProxy('playerRef');
export const reviveSessions = new Map();
export const reviverSessions = new Map();
export const reviverCooldown = new Map();
export let reviveIntervalId = null;

export function setReviveIntervalId(id) {
    reviveIntervalId = id;
}

export const GlobalPlayerCaches = new Map();

function ensureGPC(id) {
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
            for (const [id, cache] of GlobalPlayerCaches.entries()) {
                if (!cache) continue;
                const value = cache[key];
                if (value === undefined) continue;
                yield [id, value];
            }
        },
        clear() {
            for (const cache of GlobalPlayerCaches.values()) {
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
        for (const c of GlobalPlayerCaches.values()) {
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

export const isUHC = (e) => e && uhcPlayerIds.has(e.id);

for (let i = 0; i < TEAMS.length; i++) {
    teamStats.set(TEAMS[i].id, { kills: 0, deaths: 0 });
}

export const particleLocPool = { x: 0, y: 0, z: 0 };
export const teleportLocPool = { x: 0, y: 0, z: 0 };
export const spawnEntityLocPool = { x: 0, y: 0, z: 0 };

export const entityQueryOptions = {
    type: 'minecraft:item',
    location: { x: 0, y: 0, z: 0 },
    maxDistance: 16,
};

export const itemVacuumQueue = [];
export let itemVacuumRunning = false;
export function setItemVacuumRunning(v) {
    itemVacuumRunning = v;
}

export const deathQueue = [];
export let deathBatchRunning = false;
export function setDeathBatchRunning(v) {
    deathBatchRunning = v;
}

export const getPlayersByTeamBuf = [];

export let cachedBoard;
export let sidebarFlushTask = null;
export const dirtySidebarTeams = new Set();

export function setCachedBoard(b) {
    cachedBoard = b;
}
export function setSidebarFlushTask(t) {
    sidebarFlushTask = t;
}

export let kdHistoryObj = null;
export let teamKillObj = null;

export function setKdHistoryObj(o) {
    kdHistoryObj = o;
}
export function setTeamKillObj(o) {
    teamKillObj = o;
}
export function getKdHistoryObjective() {
    return kdHistoryObj;
}
export function getTeamKillObjective() {
    return teamKillObj;
}

export let statsDirty = false;
export let statsSaveTask = null;

export function setStatsDirty(v) {
    statsDirty = v;
}
export function setStatsSaveTask(t) {
    statsSaveTask = t;
}

export let firstBloodDone = false;
export function setFirstBloodDone(v) {
    firstBloodDone = v;
}

export let allPlayersCache = [];
export let uhcPlayersCache = [];
export let allPlayersCacheIds = new Set();

export let aliveTeamDirtyHandler = () => {};
export function setAliveTeamDirtyHandler(handler) {
    aliveTeamDirtyHandler = typeof handler === 'function' ? handler : () => {};
}

export function stopReviveTickIfIdle() {
    if (reviveSessions.size > 0) return;
    if (reviveIntervalId === null) return;
    system.clearRun(reviveIntervalId);
    setReviveIntervalId(null);
}

export function clearAllReviveRuntime() {
    reviveSessions.clear();
    reviverSessions.clear();
    reviverCooldown.clear();
    stopReviveTickIfIdle();
}
