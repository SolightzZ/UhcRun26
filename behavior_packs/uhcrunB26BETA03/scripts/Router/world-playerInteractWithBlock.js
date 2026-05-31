import { world } from '@minecraft/server';
import border from '../system/border.js';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';

const beforeEvents = [(ev) => border.handlePlayerInteractWithBlock(ev), (ev) => blockInteractGuard.onPlayerInteractWithBlock(ev)];

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    try {
        for (const handler of beforeEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerInteractWithBlock] error:', error.message);
    }
});
