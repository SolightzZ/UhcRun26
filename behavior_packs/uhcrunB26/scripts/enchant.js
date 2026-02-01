import { world, EquipmentSlot, ItemComponentTypes, EnchantmentType } from "@minecraft/server";
import { dynamicToast } from "./message";

const EFF_LEVEL = 4;
const ENCHANT_ID = "minecraft:efficiency";
const LORE_MARK = "§7[UHCRUN]";

const VALID_TOOLS = new Set([
  "minecraft:wooden_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:golden_pickaxe",
  "minecraft:diamond_pickaxe",
  "minecraft:wooden_shovel",
  "minecraft:stone_shovel",
  "minecraft:iron_shovel",
  "minecraft:golden_shovel",
  "minecraft:diamond_shovel",
]);

function getSelectedItem(player) {
  return player.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Mainhand);
}

function isValidTool(item) {
  return VALID_TOOLS.has(item.typeId);
}

function hasLoreMark(item) {
  return item.getLore()?.includes(LORE_MARK);
}

function markLore(item) {
  const lore = item.getLore() ?? [];
  lore.push(LORE_MARK);
  item.setLore(lore);
}

function applyEfficiency(item) {
  const ench = item.getComponent(ItemComponentTypes.Enchantable);
  if (!ench) return false;

  ench.addEnchantment({
    type: new EnchantmentType(ENCHANT_ID),
    level: EFF_LEVEL,
  });

  markLore(item);
  return true;
}

function onHotbarChange(event) {
  const player = event.player;
  const item = getSelectedItem(player);
  if (!item) return;
  if (!isValidTool(item)) return;
  if (hasLoreMark(item)) return;

  if (!applyEfficiency(item)) return;

  player.getComponent("minecraft:equippable").setEquipment(EquipmentSlot.Mainhand, item);
  world.sendMessage(dynamicToast(`§bEfficiency IV\n§7§l»§r§7 ${player.name}`));
  player.playSound("block.enchanting_table.use");
}

world.afterEvents.playerHotbarSelectedSlotChange.subscribe(onHotbarChange);
