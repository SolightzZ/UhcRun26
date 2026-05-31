import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import border from '../system/border.js';
import blockInteractGuard from '../plugin/block-interact-guard/Controller.js';

const beforeEvents = [(ev) => border.handlePlayerInteractWithBlock(ev), (ev) => blockInteractGuard.onPlayerInteractWithBlock(ev)];

world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    runEventHandlers('PlayerInteractWithBlock', beforeEvents, event);
});
