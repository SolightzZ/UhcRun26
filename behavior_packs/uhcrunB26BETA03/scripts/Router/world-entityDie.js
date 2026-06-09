import { world } from '@minecraft/server';
import { HandlerOnDeath } from '../Manager/TeamManager.js';
import { runEventHandlers } from '../plugin/Util.js';

const afterEvents = [HandlerOnDeath];

world.afterEvents.entityDie.subscribe((event) => {
   runEventHandlers('EntityDie', afterEvents, event);
});
