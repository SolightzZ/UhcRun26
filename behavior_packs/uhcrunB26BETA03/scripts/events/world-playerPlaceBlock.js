import { world } from '@minecraft/server';
import border from '../features/border/BorderManager.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => border.handlePlayerPlaceBlock(ev)];

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers('PlayerPlaceBlock', beforeEvents, event);
});
