import { ItemComponentTypes } from '@minecraft/server';
import model from './Model.js';

class Service {
    buildEnchantedItem = (item, lore) => {
        const clone = item.clone();
        const enchantable = clone.getComponent(ItemComponentTypes.Enchantable);
        if (!enchantable) return null;

        try {
            enchantable.addEnchantment({ type: model.getEfficiency(), level: model.ENCHANT_LEVEL });
        } catch (e) {
            console.warn('[Enchant] Failed to add enchantment:', e);
            return null;
        }

        clone.setLore(lore.concat(model.LORE_MARKER));
        return clone;
    };
}

export default new Service();
