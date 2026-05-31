import { world } from '@minecraft/server';
import tntInstant from '../plugin/tnt-instant/Controller.js';

const afterEvents = [(ev) => tntInstant.onPlayerPlaceBlock(ev)];

world.afterEvents.playerPlaceBlock.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerPlaceBlockAfter] error:', error.message);
    }
});
