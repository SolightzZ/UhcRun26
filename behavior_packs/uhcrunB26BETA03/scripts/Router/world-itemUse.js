import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerRevive } from '../Manager/TeamManager.js';

const afterEvents = [HandlerRevive];

world.afterEvents.itemUse.subscribe((event) => {
    runEventHandlers('ItemUse', afterEvents, event);
});
