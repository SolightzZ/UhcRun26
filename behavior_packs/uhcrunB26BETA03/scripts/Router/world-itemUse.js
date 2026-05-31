import { world } from '@minecraft/server';
import { HandlerRevive } from '../Manager/TeamManager.js';

const afterEvents = [HandlerRevive];

world.afterEvents.itemUse.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[ItemUse] error:', error.message);
    }
});
