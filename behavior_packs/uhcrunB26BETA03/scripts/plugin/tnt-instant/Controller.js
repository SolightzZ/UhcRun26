import { world } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

class Controller {
    register = () => {
        world.afterEvents.playerPlaceBlock.subscribe(
            ({ block, player }) => {
                service.placeTnt(block, player);
            },
            { blockTypes: [model.TNT] },
        );

        world.afterEvents.playerLeave.subscribe(({ playerId }) => {
            model.cdMap.delete(playerId);
        });
    };
}

export default new Controller();
