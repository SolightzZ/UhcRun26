// ออโต้ smelt / diamond / lapis / gravel / redstone ตอนขุดบล็อก
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, ItemStack } from "@minecraft/server";

// ========== ตัวเลข (number) ==========
const num = {
  itemRadius: 2,
  xpSmeltMin: 1,
  xpSmeltMax: 4,
  xpCoalMin: 1,
  xpCoalMax: 10,
  xpEmeraldMin: 1,
  xpEmeraldMax: 15,
  chanceBook: 0.2,
  chanceAbsorb: 0.25,
};

// ========== ข้อความ (text) / sound ==========
const txt = {
  soundOrb: "random.orb",
  soundLevel: "random.levelup",
};

// บล็อก -> ประเภทการทำงาน — Map O(1)
const blockMap = new Map([
  ["minecraft:iron_ore", "smelt"],
  ["minecraft:deepslate_iron_ore", "smelt"],
  ["minecraft:gold_ore", "smelt"],
  ["minecraft:deepslate_gold_ore", "smelt"],
  ["minecraft:coal_ore", "smelt"],
  ["minecraft:diamond_ore", "diamond"],
  ["minecraft:deepslate_diamond_ore", "diamond"],
  ["minecraft:obsidian", "diamond"],
  ["minecraft:lapis_ore", "lapis"],
  ["minecraft:deepslate_lapis_ore", "lapis"],
  ["minecraft:gravel", "oreGravel"],
  ["minecraft:emerald_ore", "oreGravel"],
  ["minecraft:deepslate_emerald_ore", "oreGravel"],
  ["fake:redstone_ores", "redstone"],
]);

// raw -> ingot — Map O(1)
const smeltMap = new Map([
  ["minecraft:raw_iron", "minecraft:iron_ingot"],
  ["minecraft:raw_gold", "minecraft:gold_ingot"],
]);

// ไอเทมที่ให้ XP — Set O(1)
const xpItems = new Set(["minecraft:coal", "minecraft:emerald"]);

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function playOrb(plr, vol) {
  plr.playSound(txt.soundOrb, { volume: vol ?? 0.2, pitch: 1.5 });
}

function spawnItem(dim, typeId, amount, loc) {
  dim.spawnItem(new ItemStack(typeId, amount), loc);
}

function getNearbyItems(plr, block) {
  return plr.dimension.getEntities({
    type: "minecraft:item",
    location: block.location,
    maxDistance: num.itemRadius,
  });
}

function getItemStack(entity) {
  return entity.getComponent("minecraft:item").itemStack;
}

function doSmelt(block, plr) {
  const entities = getNearbyItems(plr, block);
  if (entities.length === 0) return;

  for (const e of entities) {
    const item = getItemStack(e);
    const out = smeltMap.get(item.typeId);
    if (!out) continue;

    spawnItem(plr.dimension, out, item.amount, e.location);
    plr.addExperience(rand(num.xpSmeltMin, num.xpSmeltMax));
    playOrb(plr);
    e.remove();
  }
}

function doOreGravel(block, plr) {
  const entities = getNearbyItems(plr, block);
  if (entities.length === 0) return;

  for (const e of entities) {
    const item = getItemStack(e);

    if (item.typeId === "minecraft:flint") {
      spawnItem(plr.dimension, "minecraft:arrow", item.amount, e.location);
      playOrb(plr);
      e.remove();
      continue;
    }

    if (xpItems.has(item.typeId)) {
      giveOreXp(plr, item.typeId);
      playOrb(plr);
      e.remove();
    }
  }
}

function giveOreXp(plr, typeId) {
  if (typeId === "minecraft:coal") {
    plr.addExperience(rand(num.xpCoalMin, num.xpCoalMax));
  }
  if (typeId === "minecraft:emerald") {
    plr.addExperience(rand(num.xpEmeraldMin, num.xpEmeraldMax));
  }
}

function doDiamond(block, plr) {
  playOrb(plr);
}

function doLapis(block, plr) {
  if (Math.random() < num.chanceBook) {
    spawnItem(plr.dimension, "minecraft:book", 1, plr.location);
    plr.playSound(txt.soundLevel, { volume: 0.2, pitch: 1.5 });
    plr.onScreenDisplay.setActionBar("");
  }
}

function doRedstone(block, plr) {
  plr.addExperience(rand(1, 4));
  playOrb(plr, 0.4);

  if (Math.random() < num.chanceAbsorb) {
    plr.addEffect("absorption", 600, {
      showParticles: false,
      amplifier: 0,
    });
    plr.playSound(txt.soundLevel, { volume: 0.8, pitch: 1.5 });
    plr.onScreenDisplay.setActionBar("");
  }
}

// ประเภท -> ฟังก์ชันจัดการ — O(1) lookup
const mechanicMap = {
  smelt: doSmelt,
  oreGravel: doOreGravel,
  diamond: doDiamond,
  lapis: doLapis,
  redstone: doRedstone,
};

function dispatch(blockId, block, plr) {
  const type = blockMap.get(blockId);
  if (!type) return;

  const fn = mechanicMap[type];
  if (fn) fn(block, plr);
}

function onBreakBlock(e) {
  const { player, block, brokenBlockPermutation } = e;
  dispatch(brokenBlockPermutation.type.id, block, player);
}

world.afterEvents.playerBreakBlock.subscribe(onBreakBlock);
