import { world } from '@minecraft/server';
import { HandlerCancelNPC } from '../Manager/LeaderboardNPC.js';
import border from '../system/border.js';

const beforeEvents = [HandlerCancelNPC, (ev) => border.handlePlayerInteractWithEntity(ev)];

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    try {
        for (const handler of beforeEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerInteractWithEntity] error:', error.message);
    }
});
