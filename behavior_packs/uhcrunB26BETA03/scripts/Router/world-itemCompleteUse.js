import { world } from '@minecraft/server';
import itemConsumeEffects from '../plugin/item-consume-effects/Controller.js';

const afterEvents = [(ev) => itemConsumeEffects.onItemCompleteUse(ev)];

world.afterEvents.itemCompleteUse.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[ItemCompleteUse] error:', error.message);
    }
});
