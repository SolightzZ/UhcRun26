import { world } from '@minecraft/server';
import plateKnockback from '../plugin/plate-knockback/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => plateKnockback.onPressurePlatePush(ev)];

world.afterEvents.pressurePlatePush.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
