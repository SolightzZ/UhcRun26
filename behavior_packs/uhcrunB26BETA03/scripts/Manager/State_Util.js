/** Create a fresh {x,y,z} location object. Use this instead of shared mutable pools. */
export function createLoc(x = 0, y = 0, z = 0) {
    return { x, y, z };
}

/** Create fresh entity query options for item vacuum. Each call avoids sharing mutable state. */
export function createItemQueryOptions(x, y, z, maxDistance = 16) {
    return {
        type: 'minecraft:item',
        location: { x, y, z },
        maxDistance,
    };
}

// @deprecated — Shared mutable objects. Do NOT use in new code.
// These will be removed; use createLoc() and createItemQueryOptions() instead.
export const particleLocPool = { x: 0, y: 0, z: 0 };
export const teleportLocPool = { x: 0, y: 0, z: 0 };
export const spawnEntityLocPool = { x: 0, y: 0, z: 0 };

export const entityQueryOptions = {
  type: 'minecraft:item',
  location: { x: 0, y: 0, z: 0 },
  maxDistance: 16,
};
