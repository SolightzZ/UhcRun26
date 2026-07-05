import { world } from '@minecraft/server';
import border from '../features/border/BorderManager.js';
import { HandlerCancelNPC } from '../features/leaderboard/LeaderboardManager.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [HandlerCancelNPC, (ev) => border.handlePlayerInteractWithEntity(ev)];

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
   runEventHandlers('PlayerInteractWithEntity', beforeEvents, event);
});
