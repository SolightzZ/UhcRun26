import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import border from '../system/border.js';

const beforeEvents = [(ev) => border.handlePlayerPlaceBlock(ev)];

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers('PlayerPlaceBlock', beforeEvents, event);
});
