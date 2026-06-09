import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import itemConsumeEffects from '../plugin/item-consume-effects/Controller.js';

const afterEvents = [(ev) => itemConsumeEffects.onItemCompleteUse(ev)];

world.afterEvents.itemCompleteUse.subscribe((event) => {
   runEventHandlers('ItemCompleteUse', afterEvents, event);
});
