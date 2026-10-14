import { world } from '@minecraft/server';
import { HandlerOnDeath } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [HandlerOnDeath];

world.afterEvents.entityDie.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
