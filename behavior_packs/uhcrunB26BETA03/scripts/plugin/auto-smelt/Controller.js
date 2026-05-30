import { world } from '@minecraft/server';
import Model from './Model.js';
import service, { isValidTool } from './Service.js';

class Controller {
    register = () => {
        world.afterEvents.playerLeave.subscribe((ev) => {
            Model.toolCache.delete(ev.playerId);
        });

        world.afterEvents.playerBreakBlock.subscribe((ev) => {
            const player = ev.player;
            if (!player?.isValid) return;

            const action = Model.BLOCK_ACTION_MAP.get(ev.brokenBlockPermutation.type.id);
            if (!action) return;

            const tool = service.getCachedTool(player);
            if (!tool || !isValidTool(tool, action)) return;

            service.executeAction(player, ev.block.location, action, ev.block.dimension);
        });
    };
}

export default new Controller();
