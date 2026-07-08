import { EquipmentSlot, ItemStack } from '@minecraft/server';
import { enqueueAddEffect, enqueueRemoveEffect } from '../../shared/AddEffectBatcher.js';
import { getCachedPlayers, getPlayerTeam } from '../../features/team/TeamActions.js';
import { COMPASS_ITEM, logError, setAdventure, setSpectator } from '../../shared/Util.js';
import { getPlayerInventoryContainer } from '../cache/CacheManager.js';
import { uhcPlayerIds } from '../cache/State_Cache.js';

const UHC_EFFECTS = ['regeneration', 'blindness', 'invisibility', 'resistance', 'conduit_power', 'slow_falling'];

const EFFECT_HIDDEN = { amplifier: 255, showParticles: false };

const START_EFFECTS = [
   ['regeneration', 26],
   ['blindness', 26],
   ['invisibility', 60],
   ['resistance', 60],
   ['night_vision', 99999],
];

class UtilUhcMatchManager {
   playerSetupAddItems(player) {
      if (!player?.isValid) return;
      const inv = getPlayerInventoryContainer(player);
      if (!inv) return;
      inv.addItem(new ItemStack('minecraft:stone_axe', 1));
      inv.addItem(new ItemStack('minecraft:stone_pickaxe', 1));
      inv.addItem(new ItemStack('minecraft:cooked_beef', 3));
      inv.addItem(new ItemStack('minecraft:oak_boat', 1));
   }

   playerSetupClearEffects(player) {
      if (!player?.isValid) return;
      for (let i = 0; i < UHC_EFFECTS.length; i++) {
         enqueueRemoveEffect(player, UHC_EFFECTS[i]);
      }
   }

   playerSetupApplyEndState(player) {
      if (!player?.isValid) return;
      try {
          if (getPlayerTeam(player)) {
             player.removeTag('uhc');
             uhcPlayerIds.delete(player.id);
             enqueueAddEffect(player, 'regeneration', 26 * 20, EFFECT_HIDDEN);
            return;
         }
         setAdventure(player);
          enqueueRemoveEffect(player, 'conduit_power');
      } catch (error) {
         logError('UtilUHC', 'Failed to apply end state for ' + player.name, error);
      }
   }

   playerSetupApplyStartState(player) {
      if (!player?.isValid) return;

      try {
         if (getPlayerTeam(player)) {
             if (!uhcPlayerIds.has(player.id)) {
                player.addTag('uhc');
                uhcPlayerIds.add(player.id);
             }
         for (let si = 0; si < START_EFFECTS.length; si++) {
            const effect = START_EFFECTS[si][0];
            const seconds = START_EFFECTS[si][1];
            enqueueAddEffect(player, effect, seconds * 20, EFFECT_HIDDEN);
         }
            enqueueAddEffect(player, 'conduit_power', 250 * 20, { amplifier: 0, showParticles: false });
            return;
         }
          setSpectator(player);
          enqueueAddEffect(player, 'conduit_power', 9999, { amplifier: 0, showParticles: false });
      } catch (error) {
         logError('UtilUHC', 'Failed to apply start state for ' + player.name, error);
      }
   }

   playerSetupClearItemsKeepCompass(targetPlayer) {
      const players = targetPlayer && targetPlayer.isValid ? [targetPlayer] : getCachedPlayers();
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
