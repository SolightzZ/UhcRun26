import { world } from "@minecraft/server";

const BLOCK_BLACKLIST = new Set([
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
  "minecraft:room",
]);

const DOOR_KEYWORDS = [
  "ender_chest",
  "wheat",
  "gate",
  "trapdoor",
  "crafter",
  "anvil",
  "crafting_table",
  "candle",
  "spruce_hanging_sign",
  "minecraft:decorated_pot",
];

const KNOCKBACK_STRENGTH = -2;
const KNOCKBACK_VERTICAL = 0.5;
const SFX_REJECT = ["mob.shulker.shoot", "firework.blast", "firework.large_blast", "firework.twinkle"];
const SFX_BLOCK = "note.bass";

function isBlockedContainer(typeId) {
  return BLOCK_BLACKLIST.has(typeId);
}

function isRestrictedDoor(typeId, player) {
  if (player.hasTag("uhc")) return false;
  return DOOR_KEYWORDS.some((key) => typeId.includes(key));
}

function getRandomSound(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function knockbackPlayer(player) {
  const dir = player.getViewDirection();
  player.applyKnockback({ x: dir.x * KNOCKBACK_STRENGTH, z: dir.z * KNOCKBACK_STRENGTH }, KNOCKBACK_VERTICAL);
}

function playRejectSound(player) {
  player.playSound(getRandomSound(SFX_REJECT), player.location);
}

function playBlockSound(player) {
  player.playSound(SFX_BLOCK, { volume: 1, pitch: 1 });
}

function onPlayerUseBlock(event) {
  const { block, player } = event;
  if (!block?.typeId) return;

  const typeId = block.typeId;

  if (typeId === "minecraft:ender_chest") {
    event.cancel = true;
    Promise.resolve().then(() => {
      knockbackPlayer(player);
      playRejectSound(player);
    });
    return;
  }

  if (isBlockedContainer(typeId) || isRestrictedDoor(typeId, player)) {
    event.cancel = true;
    Promise.resolve().then(() => playBlockSound(player));
  }
}

world.beforeEvents.playerInteractWithBlock.subscribe(onPlayerUseBlock);
