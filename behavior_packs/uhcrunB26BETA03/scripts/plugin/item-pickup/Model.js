class Model {
    SMELT = Object.freeze({
        'minecraft:raw_iron': 'minecraft:iron_ingot',
        'minecraft:raw_gold': 'minecraft:gold_ingot',
    });

    SMELT_TYPES = new Set(Object.keys(this.SMELT));

    PENDING_MAX = 32;
    pendingList = [];
    flushScheduled = false;
}

export default new Model();
