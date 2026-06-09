class Model {
   COOKED_FOOD = Object.freeze({
      items: Object.freeze([
         'minecraft:cooked_beef',
         'minecraft:cooked_porkchop',
         'minecraft:cooked_chicken',
         'minecraft:cooked_mutton',
         'minecraft:cooked_rabbit',
         'minecraft:cooked_cod',
         'minecraft:cooked_salmon',
      ]),
      effect: Object.freeze({
         id: 'regeneration',
         duration: 200,
         amplifier: 1,
         showParticles: false,
      }),
   });
}

export default new Model();
