import { enqueueAddEffect } from '../../shared/AddEffectBatcher.js';
import { enqueuePlayerSound, enqueuePlayerSetActionBar } from '../../shared/MessageBatcher.js';
import { logError } from '../../shared/Util.js';
import model from './Model.js';

class Service {
   isCookedFood = (itemId) => {
      if (!itemId) return false;
      return model.COOKED_FOOD.items.has(itemId);
   };

   applyCookedEffect = (player) => {
      if (!player?.isValid) return;
      const { id, duration, amplifier, showParticles } = model.COOKED_FOOD.effect;
      enqueueAddEffect(player, id, duration, { amplifier, showParticles });
      enqueuePlayerSetActionBar(player, '§a[+] Regeneration II (10s)');
      enqueuePlayerSound(player, 'fortnite-Slurp-Mushroom', { volume: 0.8, pitch: 1 });
   };

   handleConsume = (player, item) => {
      if (!player || !item) return;

      const itemId = item.typeId;
      if (!this.isCookedFood(itemId)) return;

      this.applyCookedEffect(player);
   };
}

export default new Service();
