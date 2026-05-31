import { world } from '@minecraft/server';
import enchant from '../plugin/enchant/Controller.js';

const afterEvents = [(ev) => enchant.onPlayerHotbarSelectedSlotChange(ev)];

world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerHotbarSelectedSlotChange] error:', error.message);
    }
});
