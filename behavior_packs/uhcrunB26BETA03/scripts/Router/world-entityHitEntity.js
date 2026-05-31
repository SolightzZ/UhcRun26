import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';

const afterEvents = [(ev) => anticheatCps.onEntityHitEntity(ev)];

world.afterEvents.entityHitEntity.subscribe((event) => {
    runEventHandlers('EntityHitEntity', afterEvents, event);
});
