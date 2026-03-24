import { world, system } from "@minecraft/server";

const BLOCK_DENYLIST = new Set([
  "minecraft:cartography_table",
  "minecraft:brewing_stand",
  "minecraft:furnace",
  "minecraft:blast_furnace",
  "minecraft:grindstone",
  "minecraft:smithing_table",
  "minecraft:ender_chest",
  "minecraft:shulker_box",
  "minecraft:hopper",
  "minecraft:flower_pot",
  "minecraft:smoker",
  "minecraft:respawn_anchor",
  "minecraft:barrel",
  "minecraft:composter",
]);

const DOOR_KEYWORDS = ["gate", "trapdoor", "anvil", "crafting_table", "candle", "decorated_pot", "crafter"];
const DOOR_KEYWORDS_LEN = DOOR_KEYWORDS.length;

const SHULKER_SOUNDS = ["mob.shulker.shoot", "firework.blast", "firework.large_blast", "firework.twinkle"];
const SHULKER_SOUNDS_LEN = SHULKER_SOUNDS.length;

const doorLikeCache = new Map();

// Object pooling for knockback vector
const kbVec = { x: 0, z: 0 };

// Cache component name
const ITEM_COMP = "minecraft:item";

// Optimized random sound selection
function randomSound() {
  return SHULKER_SOUNDS[Math.floor(Math.random() * SHULKER_SOUNDS_LEN)];
}

function isDoorLike(typeId) {
  const cached = doorLikeCache.get(typeId);
  if (cached !== undefined) return cached;

  // Cache length for loop optimization
  for (let i = 0; i < DOOR_KEYWORDS_LEN; i++) {
    if (typeId.includes(DOOR_KEYWORDS[i])) {
      doorLikeCache.set(typeId, true);
      return true;
    }
  }

  doorLikeCache.set(typeId, false);
  return false;
}

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
  const block = event.block;

  // Early returns
  if (!block) return;
  if (!block.isValid) return;

  const typeId = block.typeId;
  const player = event.player;
  if (!player) return;

  // Ender chest special handling
  if (typeId === "minecraft:ender_chest") {
    event.cancel = true;

    const dir = player.getViewDirection();

    system.run(() => {
      if (!player?.isValid) return;

      // Reuse pooled knockback vector
      kbVec.x = -dir.x * 2;
      kbVec.z = -dir.z * 2;

      player.applyKnockback(kbVec, 0.5);
      player.playSound(randomSound(), player.location);
    });

    return;
  }

  // Block denylist check
  if (BLOCK_DENYLIST.has(typeId)) {
    event.cancel = true;
    return;
  }

  // Door-like block check for non-UHC players
  if (!player.hasTag("uhc") && isDoorLike(typeId)) {
    event.cancel = true;
  }
});

world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;

  // Early returns
  if (!e) return;
  if (!e.isValid) return;
  if (e.typeId !== "minecraft:item") return;

  // Cache component lookup
  const itemComp = e.getComponent(ITEM_COMP);
  if (!itemComp) return;

  const stack = itemComp.itemStack;
  if (!stack) return;
  if (stack.typeId !== "minecraft:hopper_minecart") return;

  // Remove hopper minecart
  const dim = e.dimension;
  const loc = e.location;

  dim.spawnParticle("minecraft:explode_particle", loc);

  if (e.isValid) e.remove();
});
