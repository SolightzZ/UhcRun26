import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import border from '../system/border.js';

const beforeEvents = [(ev) => border.handlePlayerBreakBlock(ev)];

world.beforeEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers('PlayerBreakBlock', beforeEvents, event);
});
