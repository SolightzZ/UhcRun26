import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';

const afterEvents = [(ev) => blockInteractGuard.onEntitySpawn(ev)];

world.afterEvents.entitySpawn.subscribe((event) => {
    runEventHandlers('EntitySpawn', afterEvents, event);
});
