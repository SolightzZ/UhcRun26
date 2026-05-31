import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import itemPickup from '../plugin/item-pickup/Controller.js';

const afterEvents = [(ev) => itemPickup.onEntityItemPickup(ev)];

world.afterEvents.entityItemPickup.subscribe((event) => {
    runEventHandlers('EntityItemPickup', afterEvents, event);
});
