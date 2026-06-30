import { world } from '@minecraft/server';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => blockInteractGuard.onEntitySpawn(ev)];

world.afterEvents.entitySpawn.subscribe((event) => {
   runEventHandlers('EntitySpawn', afterEvents, event);
});
