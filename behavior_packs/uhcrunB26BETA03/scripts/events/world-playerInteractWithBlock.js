import { world } from '@minecraft/server';
import BorderManager from '../features/border/BorderManager.js';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => BorderManager.handlePlayerInteractWithBlock(ev), (ev) => blockInteractGuard.onPlayerInteractWithBlock(ev)];

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
   runEventHandlers(beforeEvents, event);
});
