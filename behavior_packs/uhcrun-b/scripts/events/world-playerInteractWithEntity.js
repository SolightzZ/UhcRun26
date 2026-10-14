import { world } from '@minecraft/server';
import BorderManager from '../features/border/BorderManager.js';
import { HandlerCancelNPC } from '../features/leaderboard/LeaderboardManager.js';
import { runEventHandlers } from '../shared/Util.js';

const beforeEvents = [HandlerCancelNPC, (ev) => BorderManager.handlePlayerInteractWithEntity(ev)];

world.beforeEvents.playerInteractWithEntity.subscribe((event) => {
   runEventHandlers(beforeEvents, event);
});
