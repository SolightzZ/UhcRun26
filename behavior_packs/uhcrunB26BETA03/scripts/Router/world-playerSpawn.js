import { world } from '@minecraft/server';
import { HandlerOnSpawn } from '../Manager/TeamManager.js';
import umm from '../system/UhcMatchManager.js';

const afterEvents = [HandlerOnSpawn, (ev) => umm.handlePlayerSpawn(ev)];

world.afterEvents.playerSpawn.subscribe((event) => {
    try {
        for (const handler of afterEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[PlayerSpawn] error:', error.message);
    }
});
