import { world } from '@minecraft/server';
import border from '../features/border/BorderGuard.js';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [(ev) => border.handlePlayerInteractWithBlock(ev), (ev) => blockInteractGuard.onPlayerInteractWithBlock(ev)];

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
   runEventHandlers('PlayerInteractWithBlock', beforeEvents, event);
});
