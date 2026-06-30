// Global player cache เก็บ state ทั้งหมดแยกตาม id
const GlobalPlayerCaches = new Map();

// สร้าง cache object สำหรับ id ถ้ายังไม่มี
function ensureGPC(id) {
   let cache = GlobalPlayerCaches.get(id);
   if (cache) return cache;
   cache = {};
   GlobalPlayerCaches.set(id, cache);
   return cache;
}

// สร้าง proxy สำหรับเข้าถึง cache แยกตาม key (teamId, hit, multiKill, ฯลฯ)
function createCacheProxy(key) {
   let size = 0;
   const proxy = {
      get(id) {
         if (!id || typeof id !== 'string') return undefined;
         return GlobalPlayerCaches.get(id)?.[key];
      },
      set(id, val) {
         if (!id || typeof id !== 'string') return proxy;
         const cache = ensureGPC(id);
         const exists = cache[key] !== undefined;
         cache[key] = val;
         if (!exists) size++;
         return proxy;
      },
      delete(id) {
         if (!id || typeof id !== 'string') return false;
         const cache = GlobalPlayerCaches.get(id);
         if (!cache || cache[key] === undefined) return false;
         delete cache[key];
         size--;
         return true;
      },
      has(id) {
         if (!id || typeof id !== 'string') return false;
         return GlobalPlayerCaches.get(id)?.[key] !== undefined;
      },
      *entries() {
         for (const gEntry of GlobalPlayerCaches) {
            const [id, cache] = gEntry;
            if (!cache) continue;
            const value = cache[key];
            if (value === undefined) continue;
            yield [id, value];
         }
      },
      [Symbol.iterator]() {
         return this.entries();
      },
      clear() {
         for (const gValue of GlobalPlayerCaches.values()) {
            if (gValue && gValue[key] !== undefined) {
               delete gValue[key];
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
export const inventoryCache = createCacheProxy('inventory');

//ตรวจสอบถ้าเป็น uhc player (มี isUhc flag)
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
      for (const gValue of GlobalPlayerCaches.values()) {
         if (gValue.isUhc === true) {
            delete gValue.isUhc;
         }
      }
      this._size = 0;
   },
   get size() {
      return this._size;
   },
};

export const isUHC = (entity) => entity && uhcPlayerIds.has(entity.id);

// cache arrays สำหรับผู้เล่นทั้งหมด / uhc players
export let allPlayersCache = [];
export let uhcPlayersCache = [];
export let allPlayersCacheIds = new Set();
