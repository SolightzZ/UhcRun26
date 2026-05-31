import { world } from '@minecraft/server';
import border from '../system/border.js';

const beforeEvents = [(ev) => border.handlePlayerBreakBlock(ev)];

world.beforeEvents.playerBreakBlock.subscribe((event) => {
    try {
        for (const handler of beforeEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerBreakBlock] error:', error.message);
    }
});
