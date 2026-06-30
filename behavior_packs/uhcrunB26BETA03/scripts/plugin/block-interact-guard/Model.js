import { LRUMap } from '../../shared/LRUMap.js';

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

   SPECTATOR_DENYLIST = new Set(['minecraft:chest', 'minecraft:trapped_chest', 'minecraft:dispenser', 'minecraft:dropper', 'minecraft:chiseled_bookshelf']);

   DOOR_KEYWORDS = ['gate', 'trapdoor', 'candle', 'decorated_pot', 'crafter'];
   DOOR_REGEX = new RegExp(this.DOOR_KEYWORDS.join('|'));

   doorLikeCache = new LRUMap(128);

   SHULKER_SOUNDS = ['mob.shulker.shoot', 'firework.blast', 'firework.large_blast', 'firework.twinkle'];
   shulkerSoundIdx = 0;
}

export default new Model();
