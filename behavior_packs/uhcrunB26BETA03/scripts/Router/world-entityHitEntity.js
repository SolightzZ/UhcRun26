import { world } from '@minecraft/server';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';

const afterEvents = [(ev) => anticheatCps.onEntityHitEntity(ev)];

world.afterEvents.entityHitEntity.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[EntityHitEntity] error:', error.message);
    }
});
