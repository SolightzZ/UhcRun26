import { world } from '@minecraft/server';
import itemPickup from '../plugin/item-pickup/Controller.js';

const afterEvents = [(ev) => itemPickup.onEntityItemPickup(ev)];

world.afterEvents.entityItemPickup.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[EntityItemPickup] error:', error.message);
    }
});
