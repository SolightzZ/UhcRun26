export const playerTeamCache = new Map();
export const hitRegistry = new Map();
export const multiKill = new Map();
export const killStreak = new Map();
export const playerCache = new Map();
export const inventoryCache = new Map();

export const uhcPlayerIds = new Set();

export const isUHC = (entity) => entity && uhcPlayerIds.has(entity.id);

export let allPlayersCache = [];
export let uhcPlayersCache = [];
export let allPlayersCacheIds = new Set();

export function purgeOrphanInventoryCache() {
   let purged = 0;
   for (const [id] of inventoryCache) {
      if (!allPlayersCacheIds.has(id)) {
         inventoryCache.delete(id);
         purged++;
      }
   }
   return purged;
}

export function purgeOrphanPlayerCache() {
   let purged = 0;
   for (const [id] of playerCache) {
      if (!allPlayersCacheIds.has(id)) {
         playerCache.delete(id);
         purged++;
      }
   }
   return purged;
}
