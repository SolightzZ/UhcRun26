import { world } from '@minecraft/server';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';

const afterEvents = [(ev) => blockInteractGuard.onEntitySpawn(ev)];

world.afterEvents.entitySpawn.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[EntitySpawn] error:', error.message);
    }
});
