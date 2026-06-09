class Model {
   PLATE = Object.freeze({ horizontal: 0.35, vertical: 1.2 });
   PLATE_TYPES = new Set([
      'minecraft:crimson_pressure_plate',
      'minecraft:polished_blackstone_pressure_plate',
      'minecraft:light_weighted_pressure_plate',
      'minecraft:heavy_weighted_pressure_plate',
      'minecraft:stone_pressure_plate',
   ]);
   SOUNDS = ['mob.shulker.shoot', 'firework.blast', 'firework.large_blast', 'firework.twinkle'];
   soundIdx = 0;
}

export default new Model();
