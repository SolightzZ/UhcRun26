import { EnchantmentType } from "@minecraft/server";

class LRUMap {
  constructor(maxSize = Infinity, ttlTicks = 0) {
    this._m = new Map();
    this._max = maxSize;
    this._ttl = ttlTicks;
  }

  get(key) {
    if (!this._m.has(key)) return undefined;
    const val = this._m.get(key);
    this._m.delete(key);
    this._m.set(key, val);
    return val;
  }

  set(key, val) {
    if (this._m.has(key)) {
      this._m.delete(key);
    }
    this._m.set(key, val);
    if (this._m.size > this._max) {
      const oldest = this._m.keys().next().value;
      this._m.delete(oldest);
    }
  }

  delete(key) {
    this._m.delete(key);
  }
  has(key) {
    return this._m.has(key);
  }
  get size() {
    return this._m.size;
  }
  clear() {
    this._m.clear();
  }

  cleanup(currentTick) {
    if (this._ttl <= 0) return;
    for (const [key, val] of this._m) {
      if (typeof val === "number" && currentTick - val > this._ttl) {
        this._m.delete(key);
      }
    }
  }
}

class Model {
  ENCHANT_LEVEL = 4;
  LORE_MARKER = "§7[UHCRUN]";
  SOUND = "block.enchanting_table.use";

  #efficiency = null;
  getEfficiency = () =>
    (this.#efficiency ??= new EnchantmentType("minecraft:efficiency"));

  TOOLS = new Map([
    [
      "minecraft:wooden_pickaxe",
      { name: "Wooden Pickaxe", texture: "wood_pickaxe" },
    ],
    [
      "minecraft:stone_pickaxe",
      { name: "Stone Pickaxe", texture: "stone_pickaxe" },
    ],
    [
      "minecraft:iron_pickaxe",
      { name: "Iron Pickaxe", texture: "iron_pickaxe" },
    ],
    [
      "minecraft:golden_pickaxe",
      { name: "Golden Pickaxe", texture: "gold_pickaxe" },
    ],
    [
      "minecraft:diamond_pickaxe",
      { name: "Diamond Pickaxe", texture: "diamond_pickaxe" },
    ],
    [
      "minecraft:wooden_shovel",
      { name: "Wooden Shovel", texture: "wood_shovel" },
    ],
    [
      "minecraft:stone_shovel",
      { name: "Stone Shovel", texture: "stone_shovel" },
    ],
    ["minecraft:iron_shovel", { name: "Iron Shovel", texture: "iron_shovel" }],
    [
      "minecraft:golden_shovel",
      { name: "Golden Shovel", texture: "gold_shovel" },
    ],
    [
      "minecraft:diamond_shovel",
      { name: "Diamond Shovel", texture: "diamond_shovel" },
    ],
  ]);

  ENCHANT_WINDOW_TICKS = 3;
  lastEnchantTick = new LRUMap(Infinity, 100);
}

export default new Model();
