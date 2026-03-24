import { world, EquipmentSlot, ItemComponentTypes, EnchantmentType } from "@minecraft/server";
import { dynamicToast } from "./Util";

// ====================
//  Configuration
// ====================
const CONFIG = {
  enchantment: {
    type: "minecraft:efficiency",
    level: 4,
    displayName: "Efficiency",
    displayLevel: "IV",
  },
  lore: {
    marker: "§7[UHCRUN]",
  },
  feedback: {
    sound: "block.enchanting_table.use",
  },
};

// ====================
//  Tool Registry
// ====================
const TOOL_REGISTRY = new Map([
  ["minecraft:wooden_pickaxe", { name: "Wooden Pickaxe", texture: "wood_pickaxe" }],
  ["minecraft:stone_pickaxe", { name: "Stone Pickaxe", texture: "stone_pickaxe" }],
  ["minecraft:iron_pickaxe", { name: "Iron Pickaxe", texture: "iron_pickaxe" }],
  ["minecraft:golden_pickaxe", { name: "Golden Pickaxe", texture: "gold_pickaxe" }],
  ["minecraft:diamond_pickaxe", { name: "Diamond Pickaxe", texture: "diamond_pickaxe" }],

  ["minecraft:wooden_shovel", { name: "Wooden Shovel", texture: "wood_shovel" }],
  ["minecraft:stone_shovel", { name: "Stone Shovel", texture: "stone_shovel" }],
  ["minecraft:iron_shovel", { name: "Iron Shovel", texture: "iron_shovel" }],
  ["minecraft:golden_shovel", { name: "Golden Shovel", texture: "gold_shovel" }],
  ["minecraft:diamond_shovel", { name: "Diamond Shovel", texture: "diamond_shovel" }],
]);

// ====================
// Cached Enchantment
// ====================
let EFFICIENCY_ENCHANT = null;

function getEfficiencyEnchant() {
  if (!EFFICIENCY_ENCHANT) {
    EFFICIENCY_ENCHANT = new EnchantmentType(CONFIG.enchantment.type);
  }
  return EFFICIENCY_ENCHANT;
}

// ====================
// Utility Functions
// ====================
function hasLoreMarker(item) {
  const lore = item.getLore();
  return lore && lore.includes(CONFIG.lore.marker);
}

function addLoreMarker(item) {
  const lore = item.getLore();
  if (lore) {
    lore.push(CONFIG.lore.marker);
    item.setLore(lore);
  } else {
    item.setLore([CONFIG.lore.marker]);
  }
}

function applyEnchantment(item) {
  const enchantable = item.getComponent(ItemComponentTypes.Enchantable);
  if (!enchantable) return false;

  enchantable.addEnchantment({
    type: getEfficiencyEnchant(),
    level: CONFIG.enchantment.level,
  });
  return true;
}

function notifyPlayer(player, toolInfo) {
  const message = `§f${toolInfo.name}\n§7${CONFIG.enchantment.displayName} §b${CONFIG.enchantment.displayLevel}`;
  const texturePath = `textures/items/${toolInfo.texture}`;

  player.sendMessage(dynamicToast(message, texturePath));
  player.playSound(CONFIG.feedback.sound);
}
// ====================
// Event Handler
// ====================
world.afterEvents.playerHotbarSelectedSlotChange.subscribe(({ player }) => {
  // Validate player
  if (!player?.isValid) return;

  // Get equipment
  const equip = player.getComponent("minecraft:equippable");
  if (!equip) return;

  // Get item
  const item = equip.getEquipment(EquipmentSlot.Mainhand);
  if (!item) return;

  // Check if tool is supported
  const toolInfo = TOOL_REGISTRY.get(item.typeId);
  if (!toolInfo) return;

  // Check if already enchanted
  if (hasLoreMarker(item)) return;

  // Apply enchantment
  if (!applyEnchantment(item)) return;

  // Add lore marker
  addLoreMarker(item);

  // Update equipment
  equip.setEquipment(EquipmentSlot.Mainhand, item);

  // Notify player
  notifyPlayer(player, toolInfo);
});
