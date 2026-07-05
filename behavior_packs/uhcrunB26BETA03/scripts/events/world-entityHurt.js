import { world } from '@minecraft/server';
import { HandlerOnHurt } from '../features/stats/DeathManager.js';
import knockback from '../plugin/knockback/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [HandlerOnHurt, (ev) => knockback.onEntityHurt(ev)];

world.afterEvents.entityHurt.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
