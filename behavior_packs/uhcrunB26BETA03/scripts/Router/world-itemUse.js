import { world } from '@minecraft/server';
import { HandlerRevive } from '../Manager/TeamManager.js';
import { runEventHandlers } from '../plugin/Util.js';

const afterEvents = [HandlerRevive];

world.afterEvents.itemUse.subscribe((event) => {
   runEventHandlers('ItemUse', afterEvents, event);
});
