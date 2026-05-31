import { world } from '@minecraft/server';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';

const afterEvents = [(ev) => autoSmelt.onPlayerBreakBlock(ev), (ev) => axe.onPlayerBreakBlock(ev)];

world.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerBreakBlockAfter] error:', error.message);
    }
});
