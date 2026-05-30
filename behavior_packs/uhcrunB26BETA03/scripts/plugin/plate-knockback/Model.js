class Model {
    PLATE = Object.freeze({ horizontal: 0.35, vertical: 1.2 });
    PLATE_TYPES = new Set(['minecraft:crimson_pressure_plate']);
    SOUNDS = ['mob.shulker.shoot', 'firework.blast', 'firework.large_blast', 'firework.twinkle'];
    soundIdx = 0;
}

export default new Model();
