import { world } from '@minecraft/server';
import itemPickup from '../plugin/item-pickup/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => itemPickup.onEntityItemPickup(ev)];

world.afterEvents.entityItemPickup.subscribe((event) => {
   runEventHandlers('EntityItemPickup', afterEvents, event);
});
