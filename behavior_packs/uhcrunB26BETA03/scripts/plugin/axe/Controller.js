import { system, world } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

class Controller {
    register = () => {
        system.run(() => {
            model.getAir();
        });

        world.afterEvents.playerBreakBlock.subscribe(service.onPlayerBreakBlock);

        world.afterEvents.playerLeave.subscribe(({ playerId }) => {
            model.lastFellTick.delete(playerId);
            model.playerJobCount.delete(playerId);
            model.lastEnqueueTick.delete(playerId);
        });
    };
}

export default new Controller();
