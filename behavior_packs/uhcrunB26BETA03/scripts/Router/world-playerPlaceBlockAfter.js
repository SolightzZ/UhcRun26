import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import tntInstant from '../plugin/tnt-instant/Controller.js';

const afterEvents = [(ev) => tntInstant.onPlayerPlaceBlock(ev)];

world.afterEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers('PlayerPlaceBlockAfter', afterEvents, event);
});
