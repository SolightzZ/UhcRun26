import { world } from '@minecraft/server';
import service from './Service.js';

class Controller {
    register = () => {
        world.afterEvents.entityItemPickup.subscribe(service.onPickup);
    };
}

export default new Controller();
