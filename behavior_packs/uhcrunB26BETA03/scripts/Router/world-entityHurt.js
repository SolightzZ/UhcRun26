import { world } from '@minecraft/server';
import { HandlerOnHurt } from '../Manager/DeathManager.js';
import knockback from '../plugin/knockback/Controller.js';

const afterEvents = [HandlerOnHurt, (ev) => knockback.onEntityHurt(ev)];

world.afterEvents.entityHurt.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[EntityHurt] error:', error.message);
    }
});
