import { world } from '@minecraft/server';
import service from './Service.js';

class Controller {
    register = () => {
        world.afterEvents.itemCompleteUse.subscribe((ev) => {
            const player = ev.source;
            if (!player?.isValid) return;

            const item = ev.itemStack;
            if (!item) return;

            service.handleConsume(player, item);
        });
    };
}

export default new Controller();
