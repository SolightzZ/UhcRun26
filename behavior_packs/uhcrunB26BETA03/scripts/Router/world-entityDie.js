import { world } from '@minecraft/server';
import { HandlerOnDeath } from '../Manager/TeamManager.js';

const afterEvents = [HandlerOnDeath];

world.afterEvents.entityDie.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[EntityDie] error:', error.message);
    }
});
