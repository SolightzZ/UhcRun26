import { world } from '@minecraft/server';
import itemConsumeEffects from '../plugin/item-consume-effects/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => itemConsumeEffects.onItemCompleteUse(ev)];

world.afterEvents.itemCompleteUse.subscribe((event) => {
   runEventHandlers('ItemCompleteUse', afterEvents, event);
});
