import { world } from '@minecraft/server';
import plateKnockback from '../plugin/plate-knockback/Controller.js';

const afterEvents = [(ev) => plateKnockback.onPressurePlatePush(ev)];

world.afterEvents.pressurePlatePush.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PressurePlatePush] error:', error.message);
    }
});
