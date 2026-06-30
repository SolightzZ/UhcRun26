import { EquipmentSlot, ItemStack, world } from '@minecraft/server';
import { getPlayerTeam } from '../../features/team/TeamActions.js';
import { getPlayerInventoryContainer } from '../cache/CacheManager.js';
import { COMPASS_ITEM, logError, setAdventure, setSpectator } from '../../shared/Util.js';

//effects ที่ต้องลบออกจากผู้เล่นเมื่อจบเกม
const UHC_EFFECTS = ['regeneration', 'blindness', 'invisibility', 'resistance', 'conduit_power', 'slow_falling'];

const EFFECT_HIDDEN = { amplifier: 255, showParticles: false };

const START_EFFECTS = [
   ['regeneration', 26],
   ['blindness', 26],
   ['invisibility', 60],
   ['resistance', 60],
   ['night_vision', 99999],
];

//อรรถประโยชน์สำหรับ UhcMatchManager: จัดการ items, effects, สถานะผู้เล่น
class UtilUhcMatchManager {
   //ให้ items เริ่มต้น (ข้าวของ, อาหาร, เรือ)
   playerSetupAddItems(player) {
      if (!player?.isValid) return;
      const inv = getPlayerInventoryContainer(player);
      if (!inv) return;
      inv.addItem(new ItemStack('minecraft:stone_axe', 1));
      inv.addItem(new ItemStack('minecraft:stone_pickaxe', 1));
      inv.addItem(new ItemStack('minecraft:cooked_beef', 3));
      inv.addItem(new ItemStack('minecraft:oak_boat', 1));
   }

   // ลบ effects ทั้งหมดออกจากผู้เล่น
   playerSetupClearEffects(player) {
      if (!player?.isValid) return;
      for (let i = 0; i < UHC_EFFECTS.length; i++) {
         try {
            player.removeEffect(UHC_EFFECTS[i]);
         } catch (error) {
            logError('UtilUHC', 'Failed to remove effect ' + UHC_EFFECTS[i], error);
         }
      }
   }

   // คืนค่าผู้เล่นเมื่อจบเกม
   //คืนค่าผู้เล่นเมื่อจบเกม ลบ uhc tag, เพิ่ม regen 26 วิ
   playerSetupApplyEndState(player) {
      if (!player?.isValid) return;
      try {
         if (getPlayerTeam(player)) {
            player.removeTag('uhc');
            player.addEffect('regeneration', 26 * 20, EFFECT_HIDDEN);
            return;
         }
         setAdventure(player);
         player.removeEffect('conduit_power');
      } catch (error) {
         logError('UtilUHC', 'Failed to apply end state for ' + player.name, error);
      }
   }

   //ตั้งค่าผู้เล่นเมื่อเริ่มเกม: uhc tag, effects, spectator ถ้าไม่มีทีม
   playerSetupApplyStartState(player) {
      if (!player?.isValid) return;

      try {
         if (getPlayerTeam(player)) {
            if (!player.hasTag('uhc')) {
               player.addTag('uhc');
            }
            for (const [effect, seconds] of START_EFFECTS) {
               player.addEffect(effect, seconds * 20, EFFECT_HIDDEN);
            }
            player.addEffect('conduit_power', 250 * 20, { amplifier: 0, showParticles: false });
            return;
         }
         setSpectator(player);
         player.addEffect('conduit_power', 9999, { amplifier: 0, showParticles: false });
      } catch (error) {
         logError('UtilUHC', 'Failed to apply start state for ' + player.name, error);
      }
   }

   // ล้างของ inventory คงไว้เฉพาะ compass
   playerSetupClearItemsKeepCompass(targetPlayer) {
      const players = targetPlayer && targetPlayer.isValid ? [targetPlayer] : world.getPlayers();
      const total = players.length;
      if (total === 0) return;

      for (let i = 0; i < total; i++) {
         const p = players[i];
         if (!p?.isValid) continue;

         const inv = getPlayerInventoryContainer(p);
         if (!inv) continue;

         let foundCompass = false;

         for (let slot = 0; slot < inv.size; slot++) {
            const item = inv.getItem(slot);
            if (!item) continue;

            if (item.typeId === COMPASS_ITEM) {
               if (!foundCompass) {
                  foundCompass = true;

                  if (item.amount !== 1) {
                     item.amount = 1;
                     inv.setItem(slot, item);
                  }

                  continue;
               }
            }

            inv.setItem(slot, undefined);
         }

         if (!foundCompass) {
            inv.setItem(0, new ItemStack(COMPASS_ITEM, 1));
         }

         const equip = p.getComponent('minecraft:equippable');
         if (!equip) continue;

         equip.setEquipment(EquipmentSlot.Offhand, undefined);
         equip.setEquipment(EquipmentSlot.Head, undefined);
         equip.setEquipment(EquipmentSlot.Chest, undefined);
         equip.setEquipment(EquipmentSlot.Legs, undefined);
         equip.setEquipment(EquipmentSlot.Feet, undefined);
      }
   }
}

export default new UtilUhcMatchManager();
