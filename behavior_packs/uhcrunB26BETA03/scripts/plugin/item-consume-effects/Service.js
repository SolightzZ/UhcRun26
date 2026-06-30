import { logError } from '../../shared/Util.js';
import model from './Model.js';

class Service {
   isCookedFood = (itemId) => {
      if (!itemId) return false;
      return model.COOKED_FOOD.items.has(itemId);
   };

   applyCookedEffect = (player) => {
      if (!player?.isValid) return;
      try {
         const { id, duration, amplifier, showParticles } = model.COOKED_FOOD.effect;
         player.addEffect(id, duration, { amplifier, showParticles });
         player.onScreenDisplay.setActionBar('§a[+] Regeneration II (10s)');
         player.playSound('random.orb', { location: player.location, volume: 0.5, pitch: 1.5 });
      } catch (error) {
         logError('ItemConsume', 'Failed to apply cooked effect', error);
      }
   };

   handleConsume = (player, item) => {
      if (!player || !item) return;

      const itemId = item.typeId;
      if (!this.isCookedFood(itemId)) return;

      this.applyCookedEffect(player);
   };
}

export default new Service();
