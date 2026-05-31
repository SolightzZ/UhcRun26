import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerOnDeath } from '../Manager/TeamManager.js';

const afterEvents = [HandlerOnDeath];

world.afterEvents.entityDie.subscribe((event) => {
    runEventHandlers('EntityDie', afterEvents, event);
});
