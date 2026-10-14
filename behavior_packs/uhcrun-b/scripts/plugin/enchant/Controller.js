import { EquipmentSlot, system } from '@minecraft/server';
import { enqueuePlayerMessage, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { dynamicToast } from '../../shared/Util.js';
import model from './Model.js';
import service from './Service.js';

class Controller {
   onPlayerHotbarSelectedSlotChange = ({ player }) => {
      if (!player?.isValid) return;

      const currentTick = system.currentTick;
      const lastTick = model.lastEnchantTick.get(player.id) ?? -model.ENCHANT_WINDOW_TICKS;
      if (currentTick - lastTick < model.ENCHANT_WINDOW_TICKS) return;

      const equip = player.getComponent('minecraft:equippable');
      if (!equip) return;

      const item = equip.getEquipment(EquipmentSlot.Mainhand);
      if (!item) return;

      const tool = model.TOOLS.get(item.typeId);
      if (!tool) return;

      const loreArr = item.getLore();
      if (loreArr.indexOf(model.LORE_MARKER) !== -1) return;

      model.lastEnchantTick.set(player.id, currentTick);

      const newItem = service.buildEnchantedItem(item, loreArr);
      if (!newItem) return;

      equip.setEquipment(EquipmentSlot.Mainhand, newItem);
      enqueuePlayerMessage(player, dynamicToast(`§f${tool.name}\n§7Efficiency §bIV`, `textures/items/${tool.texture}`));
      enqueuePlayerSound(player, model.SOUND);
   };

   onPlayerLeave = ({ playerId }) => {
      model.lastEnchantTick.delete(playerId);
   };
}

export default new Controller();
