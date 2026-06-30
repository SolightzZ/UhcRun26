import { world } from '@minecraft/server';
import { runEventHandlers } from '../shared/Util.js';
import border from '../features/border/BorderGuard.js';

const beforeEvents = [(ev) => border.handlePlayerPlaceBlock(ev)];

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers('PlayerPlaceBlock', beforeEvents, event);
});
