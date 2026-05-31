import { EnchantmentType } from '@minecraft/server';

class Model {
    ENCHANT_LEVEL = 4;
    LORE_MARKER = '§7[UHCRUN]';
    SOUND = 'block.enchanting_table.use';

    #efficiency = null;
    getEfficiency = () => (this.#efficiency ??= new EnchantmentType('minecraft:efficiency'));

    TOOLS = new Map([
        ['minecraft:wooden_pickaxe', { name: 'Wooden Pickaxe', texture: 'wood_pickaxe' }],
        ['minecraft:stone_pickaxe', { name: 'Stone Pickaxe', texture: 'stone_pickaxe' }],
        ['minecraft:iron_pickaxe', { name: 'Iron Pickaxe', texture: 'iron_pickaxe' }],
        ['minecraft:golden_pickaxe', { name: 'Golden Pickaxe', texture: 'gold_pickaxe' }],
        ['minecraft:diamond_pickaxe', { name: 'Diamond Pickaxe', texture: 'diamond_pickaxe' }],
        ['minecraft:wooden_shovel', { name: 'Wooden Shovel', texture: 'wood_shovel' }],
        ['minecraft:stone_shovel', { name: 'Stone Shovel', texture: 'stone_shovel' }],
        ['minecraft:iron_shovel', { name: 'Iron Shovel', texture: 'iron_shovel' }],
        ['minecraft:golden_shovel', { name: 'Golden Shovel', texture: 'gold_shovel' }],
        ['minecraft:diamond_shovel', { name: 'Diamond Shovel', texture: 'diamond_shovel' }],
        ['minecraft:wooden_axe', { name: 'Wooden Axe', texture: 'wood_axe' }],
        ['minecraft:stone_axe', { name: 'Stone Axe', texture: 'stone_axe' }],
    ]);

    ENCHANT_WINDOW_TICKS = 3;
    lastEnchantTick = new Map();
}

export default new Model();
