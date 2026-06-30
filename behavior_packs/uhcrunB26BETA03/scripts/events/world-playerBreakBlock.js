import { world } from '@minecraft/server';
import border from '../features/border/BorderGuard.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => border.handlePlayerBreakBlock(ev)];

world.beforeEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers('PlayerBreakBlock', beforeEvents, event);
});
