import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerOnSpawn } from '../Manager/TeamManager.js';
import umm from '../system/UhcMatchManager.js';

const afterEvents = [HandlerOnSpawn, (ev) => umm.handlePlayerSpawn(ev)];

world.afterEvents.playerSpawn.subscribe((event) => {
    runEventHandlers('PlayerSpawn', afterEvents, event);
});
