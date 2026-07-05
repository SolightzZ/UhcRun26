import { world } from '@minecraft/server';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => axe.onPlayerBreakBlock(ev), (ev) => autoSmelt.onPlayerBreakBlock(ev)];

world.afterEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
