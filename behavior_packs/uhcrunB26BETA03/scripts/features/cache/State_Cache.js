export const playerTeamCache = new Map();
export const playerCache = new Map();
export const inventoryCache = new Map();
export const uhcPlayerIds = new Set();

export const isUHC = (entity) => entity && uhcPlayerIds.has(entity.id);

export let allPlayersCache = [];
export let uhcPlayersCache = [];

export function purgeOrphanInventoryCache() {
   let purged = 0;
   inventoryCache.forEach((_, id) => {
      if (!playerCache.has(id)) {
         inventoryCache.delete(id);
         purged++;
      }
   });
   return purged;
}
