export const MODE = Object.freeze({
   CLEAR: 0,
   NETHER: 2,
});

export const END_SEQUENCE_STATE = Object.freeze({
   INITIAL_WAIT: 0,
   PATTERN3: 1,
   PATTERN1: 2,
   COOLDOWN: 3,
   PATTERN2: 4,
   COMPLETED: 5,
});

export const BLOCK_CATEGORIES = Object.freeze({
   nether: ['minecraft:ancient_debris', 'minecraft:magma', 'minecraft:blackstone'],
});
