import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerCancelNPC } from '../Manager/LeaderboardNPC.js';
import border from '../system/border.js';

const beforeEvents = [HandlerCancelNPC, (ev) => border.handlePlayerInteractWithEntity(ev)];

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
    runEventHandlers('PlayerInteractWithEntity', beforeEvents, event);
});
