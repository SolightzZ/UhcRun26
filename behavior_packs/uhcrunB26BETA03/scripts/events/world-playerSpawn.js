import { world } from '@minecraft/server';
import matchManager from '../features/match/MatchManager.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import { HandlerOnSpawn } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [HandlerOnSpawn, (ev) => anticheatCps.onPlayerSpawn(ev), (ev) => matchManager.handlePlayerSpawn(ev)];

world.afterEvents.playerSpawn.subscribe((event) => {
   runEventHandlers('PlayerSpawn', afterEvents, event);
});
