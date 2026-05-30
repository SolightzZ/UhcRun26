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

    DOOR_KEYWORDS = ['gate', 'trapdoor', 'candle', 'decorated_pot', 'crafter'];
    DOOR_REGEX = new RegExp(this.DOOR_KEYWORDS.join('|'));

    DOOR_CACHE_MAX = 128;
    doorLikeCache = Object.create(null);
    doorCacheSize = 0;

    SHULKER_SOUNDS = ['mob.shulker.shoot', 'firework.blast', 'firework.large_blast', 'firework.twinkle'];
    shulkerSoundIdx = 0;
}

export default new Model();
