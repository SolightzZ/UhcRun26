import { world } from '@minecraft/server';
import tntInstant from '../plugin/tnt-instant/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => tntInstant.onPlayerPlaceBlock(ev)];

world.afterEvents.playerPlaceBlock.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
