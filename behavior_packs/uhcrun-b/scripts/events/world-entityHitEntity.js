import { world } from '@minecraft/server';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => anticheatCps.onEntityHitEntity(ev)];

world.afterEvents.entityHitEntity.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
