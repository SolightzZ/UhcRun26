import { world } from '@minecraft/server';
import { HandlerOnSpawn } from '../Manager/TeamManager.js';
import { runEventHandlers } from '../plugin/Util.js';
import umm from '../system/UhcMatchManager.js';

const afterEvents = [HandlerOnSpawn, (ev) => umm.handlePlayerSpawn(ev)];

world.afterEvents.playerSpawn.subscribe((event) => {
   runEventHandlers('PlayerSpawn', afterEvents, event);
});
