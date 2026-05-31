import { world } from '@minecraft/server';
import border from '../system/border.js';

const beforeEvents = [(ev) => border.handlePlayerPlaceBlock(ev)];

world.beforeEvents.playerPlaceBlock.subscribe((event) => {
    try {
        for (const handler of beforeEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerPlaceBlock] error:', error.message);
    }
});
