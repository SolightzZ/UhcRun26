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

        const stack = entity.getComponent('minecraft:item')?.itemStack;
        if (stack?.typeId !== 'minecraft:hopper_minecart') return;

        entity.dimension.spawnParticle('minecraft:explode_particle', entity.location);
        entity.remove();
    };
}

export default new Controller();
