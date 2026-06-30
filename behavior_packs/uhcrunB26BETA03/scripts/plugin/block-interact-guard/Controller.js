import { logError } from '../../shared/Util.js';
import model from './Model.js';
import service from './Service.js';

class Controller {
   onPlayerInteractWithBlock = (event) => {
      const { block, player } = event;
      if (!block?.isValid || !player) return;

      const { typeId } = block;

      if (typeId === 'minecraft:ender_chest') return service.handleEnderChest(event, player);
      if (model.BLOCK_DENYLIST.has(typeId)) return (event.cancel = true);

      if (!player.hasTag('uhc') && (service.isDoorLike(typeId) || model.SPECTATOR_DENYLIST.has(typeId))) {
         event.cancel = true;
         player.onScreenDisplay.setActionBar('§cSpectators cannot interact with this block!');
      }
   };

   onEntitySpawn = ({ entity }) => {
      if (!entity?.isValid || entity.typeId !== 'minecraft:item') return;

      try {
         const stack = entity.getComponent('minecraft:item')?.itemStack;
         if (stack?.typeId !== 'minecraft:hopper_minecart') return;

         entity.dimension.spawnParticle('minecraft:explosion_particle', entity.location);
         entity.remove();
      } catch (error) {
         logError('BlockGuard', 'Failed to handle entity spawn', error);
      }
   };
}

export default new Controller();
