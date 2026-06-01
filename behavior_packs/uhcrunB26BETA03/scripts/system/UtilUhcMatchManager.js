import { EquipmentSlot, GameMode, ItemStack, world } from '@minecraft/server';

import { getPlayerTeam } from '../Manager/TeamActions.js';

const UHC_EFFECTS = ['regeneration', 'blindness', 'invisibility', 'resistance', 'conduit_power', 'slow_falling'];

const effectOptionsHidden = { amplifier: 255, showParticles: false };

const UHC_PLAYER_EFFECTS = [
    ['regeneration', 520],
    ['blindness', 520],
    ['invisibility', 1200],
    ['resistance', 1200],
    ['night_vision', 99999],
];

class UtilUhcMatchManager {
    playerSetupAddItems(player) {
        if (!player?.isValid) return;
        const inv = player.getComponent('minecraft:inventory')?.container;
        if (!inv) return;
        inv.addItem(new ItemStack('minecraft:stone_axe', 1));
        inv.addItem(new ItemStack('minecraft:stone_pickaxe', 1));
        inv.addItem(new ItemStack('minecraft:cooked_beef', 3));
        inv.addItem(new ItemStack('minecraft:oak_boat', 1));
    }

    playerSetupClearEffects(player) {
        if (!player?.isValid) return;
        for (let i = 0; i < UHC_EFFECTS.length; i++) {
            try {
                player.removeEffect(UHC_EFFECTS[i]);
            } catch (e) {
                console.warn('[UtilUHC] Failed to remove effect', UHC_EFFECTS[i], ':', e);
            }
        }
    }

    playerSetupApplyEndState(player) {
        if (!player?.isValid) return;
        try {
            if (getPlayerTeam(player)) {
                player.removeTag('uhc');
                player.addEffect('regeneration', 520, effectOptionsHidden);
                return;
            }
            player.setGameMode(GameMode.Adventure);
            player.removeEffect('conduit_power');
        } catch (e) {
            console.warn('[UtilUHC] Failed to apply end state for', player.name, ':', e);
        }
    }

    playerSetupApplyStartState(player) {
        if (!player?.isValid) return;

        try {
            if (getPlayerTeam(player)) {
                if (!player.hasTag('uhc')) {
                    player.addTag('uhc');
                }
                for (let i = 0; i < UHC_PLAYER_EFFECTS.length; i++) {
                    const [effect, duration] = UHC_PLAYER_EFFECTS[i];
                    player.addEffect(effect, duration, effectOptionsHidden);
                }
                player.addEffect('conduit_power', 5000, { amplifier: 0, showParticles: false });
                return;
            }
            player.setGameMode(GameMode.Spectator);
            player.addEffect('conduit_power', 9999, { amplifier: 0, showParticles: false });
        } catch (e) {
            console.warn('[UtilUHC] Failed to apply start state for', player.name, ':', e);
        }
    }

    playerSetupClearItemsKeepCompass(targetPlayer) {
        const players = targetPlayer && targetPlayer.isValid ? [targetPlayer] : world.getPlayers();
        const total = players.length;
        if (total === 0) return;

        for (let i = 0; i < total; i++) {
            const p = players[i];
            if (!p?.isValid) continue;

            const inv = p.getComponent('minecraft:inventory')?.container;
            if (!inv) continue;

            let foundCompass = false;

            for (let slot = 0; slot < inv.size; slot++) {
                const item = inv.getItem(slot);
                if (!item) continue;

                if (item.typeId === 'minecraft:compass') {
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
                inv.setItem(0, new ItemStack('minecraft:compass', 1));
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
