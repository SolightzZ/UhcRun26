import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import plateKnockback from '../plugin/plate-knockback/Controller.js';

const afterEvents = [(ev) => plateKnockback.onPressurePlatePush(ev)];

world.afterEvents.pressurePlatePush.subscribe((event) => {
   runEventHandlers('PressurePlatePush', afterEvents, event);
});
