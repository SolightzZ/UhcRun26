import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';

const afterEvents = [(ev) => autoSmelt.onPlayerBreakBlock(ev), (ev) => axe.onPlayerBreakBlock(ev)];

world.afterEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers('PlayerBreakBlockAfter', afterEvents, event);
});
