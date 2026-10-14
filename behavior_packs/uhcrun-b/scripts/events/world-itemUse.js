import { world } from '@minecraft/server';
import { HandlerRevive } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [HandlerRevive];

world.afterEvents.itemUse.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
