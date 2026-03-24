import { world, ItemStack } from "@minecraft/server";
import { dynamicToast } from "../plugin/Util";

// ====================
// Configuration
// ====================

const CONFIG = {
  scan: {
    itemRadius: 1.6,
    maxItems: 10,
  },

  xp: {
    smelt: [1, 4],
    coal: [1, 10],
    emerald: [1, 15],
    redstone: [1, 4],
  },

  chance: {
    absorption: 16, // 16%
    lapisBook: 12, // 12%
  },

  redstone: {
    healAmount: 2,
    absorptionDuration: 7200, // ticks (6 minutes)
    absorptionMinutes: 6,
  },

  sounds: {
    orb: "random.orb",
    level: "random.levelup",
  },

  feedback: {
    arrow: { message: "Arrow §a+1", texture: "textures/items/arrow" },
    book: { message: "Book §a+1", texture: "textures/items/book_normal" },
    health: { texture: "textures/ui/heart_new" },
    absorption: { texture: "textures/ui/absorption_heart" },
  },
};

// ==================== Action Types ====================
const ACTION = {
  SMELT: 1,
  SMELT_XP: 2,
  LAPIS: 3,
  GRAVEL: 4,
  REDSTONE: 5,
  EFFECT: 6,
};

// ====================
// Block Registry
// ====================

const BLOCK_ACTION_MAP = new Map([
  // Iron & Gold Ores (Smelt)
  ["minecraft:iron_ore", ACTION.SMELT],
  ["minecraft:deepslate_iron_ore", ACTION.SMELT],
  ["minecraft:gold_ore", ACTION.SMELT],
  ["minecraft:deepslate_gold_ore", ACTION.SMELT],

  // Coal & Emerald Ores (Smelt + XP)
  ["minecraft:coal_ore", ACTION.SMELT_XP],
  ["minecraft:emerald_ore", ACTION.SMELT_XP],
  ["minecraft:deepslate_emerald_ore", ACTION.SMELT_XP],

  // Lapis Ores (Special)
  ["minecraft:lapis_ore", ACTION.LAPIS],
  ["minecraft:deepslate_lapis_ore", ACTION.LAPIS],

  // Gravel (Flint to Arrow)
  ["minecraft:gravel", ACTION.GRAVEL],

  // Redstone (Heal + Absorption)
  ["fake:redstone_ores", ACTION.REDSTONE],

  // Diamond & Obsidian (Sound Effect)
  ["minecraft:diamond_ore", ACTION.EFFECT],
  ["minecraft:deepslate_diamond_ore", ACTION.EFFECT],
  ["minecraft:obsidian", ACTION.EFFECT],
]);

// ====================
// Item Conversion Maps
// ====================

const SMELT_MAP = new Map([
  ["minecraft:raw_iron", "minecraft:iron_ingot"],
  ["minecraft:raw_gold", "minecraft:gold_ingot"],
]);

const XP_MAP = new Map([
  ["minecraft:coal", CONFIG.xp.coal],
  ["minecraft:emerald", CONFIG.xp.emerald],
]);

// ====================
// Tool Registry
// ====================

const PICKAXES = new Set([
  "minecraft:wooden_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:golden_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:diamond_pickaxe",
]);

const SHOVELS = new Set([
  "minecraft:wooden_shovel",
  "minecraft:stone_shovel",
  "minecraft:iron_shovel",
  "minecraft:golden_shovel",
  "minecraft:diamond_shovel",
]);

// ====================
//  Object Pool (Performance)
// ====================
const entityQueryOptions = {
  type: "minecraft:item",
  location: { x: 0, y: 0, z: 0 },
  maxDistance: CONFIG.scan.itemRadius,
  closest: CONFIG.scan.maxItems,
};

const soundOptions = {
  effect: { volume: 0.2, pitch: 1.5 },
  orb: { volume: 0.4, pitch: 1.5 },
  level: { volume: 0.8, pitch: 1.5 },
};

// ====================
// Utility Functions
// ====================
function randomInt(min, max) {
  return (Math.random() * (max - min + 1) + min) | 0;
}

function formatHealth(value) {
  return value.toFixed(1);
}

function getHeldItemId(player) {
  const inventory = player.getComponent("minecraft:inventory")?.container;
  if (!inventory) return null;

  const item = inventory.getItem(player.selectedSlotIndex);
  return item?.typeId ?? null;
}

function playSound(player, soundId, options) {
  player.playSound(soundId, options);
}

function isValidTool(tool, action) {
  if (action === ACTION.GRAVEL) return SHOVELS.has(tool);
  if (action === ACTION.EFFECT) return true;
  return PICKAXES.has(tool);
}

// ====================
//  Item Processing
// ====================
function processFlint(entity, player, dimension) {
  const stack = entity.getComponent("minecraft:item").itemStack;
  dimension.spawnItem(new ItemStack("minecraft:arrow", stack.amount), entity.location);
  entity.remove();

  const { message, texture } = CONFIG.feedback.arrow;
  player.sendMessage(dynamicToast(message, texture));
}

function processLapis(entity, lapisData) {
  const stack = entity.getComponent("minecraft:item").itemStack;
  const lore = stack.getLore?.();

  if (!lore || !lore.length) {
    lapisData.total += stack.amount;
    lapisData.position = entity.location;
    entity.remove();
  }
}

function processXpItem(entity, itemId, xpAccumulator) {
  const xpRange = XP_MAP.get(itemId);
  if (!xpRange) return false;

  const stack = entity.getComponent("minecraft:item").itemStack;
  xpAccumulator.value += randomInt(xpRange[0], xpRange[1]) * stack.amount;
  entity.remove();
  return true;
}

function processSmeltItem(entity, itemId, dimension, xpAccumulator) {
  const smeltedItem = SMELT_MAP.get(itemId);
  if (!smeltedItem) return false;

  const stack = entity.getComponent("minecraft:item").itemStack;
  dimension.spawnItem(new ItemStack(smeltedItem, stack.amount), entity.location);
  xpAccumulator.value += randomInt(CONFIG.xp.smelt[0], CONFIG.xp.smelt[1]) * stack.amount;
  entity.remove();
  return true;
}

function spawnLapisRewards(player, dimension, lapisData) {
  if (!lapisData.total) return;

  // Random book drop
  if (randomInt(0, 99) < CONFIG.chance.lapisBook) {
    const book = new ItemStack("minecraft:book", 1);
    dimension.spawnItem(book, lapisData.position);

    const { message, texture } = CONFIG.feedback.book;
    player.sendMessage(dynamicToast(message, texture));
  }

  // Spawn marked lapis
  const lapis = new ItemStack("minecraft:lapis_lazuli", 1);
  lapis.setLore(["§7uhc"]);
  dimension.spawnItem(lapis, lapisData.position);
}

function processItems(player, location, action) {
  const dimension = player.dimension;

  // Update query location (reuse object)
  entityQueryOptions.location.x = location.x;
  entityQueryOptions.location.y = location.y;
  entityQueryOptions.location.z = location.z;

  const entities = dimension.getEntities(entityQueryOptions);
  if (!entities.length) return;

  const xpAccumulator = { value: 0 };
  const lapisData = { total: 0, position: location };

  for (const entity of entities) {
    if (!entity?.isValid) continue;

    const itemComponent = entity.getComponent("minecraft:item");
    if (!itemComponent) continue;

    const itemId = itemComponent.itemStack.typeId;

    // Process flint to arrow
    if (itemId === "minecraft:flint") {
      processFlint(entity, player, dimension);
      continue;
    }

    // Process lapis (special handling)
    if (action === ACTION.LAPIS && itemId === "minecraft:lapis_lazuli") {
      processLapis(entity, lapisData);
      continue;
    }

    // Process XP items (coal, emerald)
    if (processXpItem(entity, itemId, xpAccumulator)) continue;

    // Process smeltable items (raw iron, raw gold)
    processSmeltItem(entity, itemId, dimension, xpAccumulator);
  }

  // Spawn lapis rewards
  spawnLapisRewards(player, dimension, lapisData);

  // Add accumulated XP
  if (xpAccumulator.value) {
    player.addExperience(xpAccumulator.value);
  }
}

// ====================
//  Redstone Handler
// ====================

function healPlayer(player) {
  const health = player.getComponent("minecraft:health");
  if (!health) return;

  const currentHealth = health.currentValue;
  const maxHealth = health.effectiveMax;

  if (currentHealth < maxHealth) {
    const newHealth = Math.min(maxHealth, currentHealth + CONFIG.redstone.healAmount);
    const delta = newHealth - currentHealth;

    health.setCurrentValue(newHealth);

    const message = `§a+${formatHealth(delta)} §7(${formatHealth(newHealth)})`;
    player.sendMessage(dynamicToast(message, CONFIG.feedback.health.texture));
  }
}

function tryApplyAbsorption(player) {
  if (randomInt(0, 99) < CONFIG.chance.absorption) {
    player.addEffect("absorption", CONFIG.redstone.absorptionDuration, {
      amplifier: 0,
      showParticles: false,
    });

    const message = `§fAbsorption §7(${CONFIG.redstone.absorptionMinutes}m)`;
    player.sendMessage(dynamicToast(message, CONFIG.feedback.absorption.texture));
    playSound(player, CONFIG.sounds.level, soundOptions.level);
    return true;
  }
  return false;
}

function handleRedstone(player) {
  // Add XP
  player.addExperience(randomInt(CONFIG.xp.redstone[0], CONFIG.xp.redstone[1]));

  // Heal player
  healPlayer(player);

  // Try absorption or play orb sound
  if (!tryApplyAbsorption(player)) {
    playSound(player, CONFIG.sounds.orb, soundOptions.orb);
  }
}

// ====================
// Event Handler
// ====================

function onPlayerBreakBlock(event) {
  const player = event.player;
  if (!player?.isValid) return;

  // Get block action
  const blockId = event.brokenBlockPermutation.type.id;
  const action = BLOCK_ACTION_MAP.get(blockId);
  if (!action) return;

  // Validate tool
  const tool = getHeldItemId(player);
  if (!tool || !isValidTool(tool, action)) return;

  const location = event.block.location;

  // Handle action
  switch (action) {
    case ACTION.SMELT:
    case ACTION.SMELT_XP:
    case ACTION.GRAVEL:
    case ACTION.LAPIS:
      processItems(player, location, action);
      break;

    case ACTION.REDSTONE:
      handleRedstone(player);
      break;

    case ACTION.EFFECT:
      playSound(player, CONFIG.sounds.orb, soundOptions.effect);
      break;
  }
}

world.afterEvents.playerBreakBlock.subscribe(onPlayerBreakBlock);
