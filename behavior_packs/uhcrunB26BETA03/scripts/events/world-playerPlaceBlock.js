import { world } from '@minecraft/server';
import BorderManager from '../features/border/BorderManager.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => BorderManager.handlePlayerPlaceBlock(ev)];

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers(beforeEvents, event);
});
