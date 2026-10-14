import { world } from '@minecraft/server';
import BorderManager from '../features/border/BorderManager.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => BorderManager.handlePlayerBreakBlock(ev)];

world.beforeEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers(beforeEvents, event);
});
