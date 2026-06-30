import { world } from '@minecraft/server';
import matchManager from '../features/match/MatchManager.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';
import enchant from '../plugin/enchant/Controller.js';
import knockback from '../plugin/knockback/Controller.js';
import tntInstant from '../plugin/tnt-instant/Controller.js';
import { HandlerOnLeave } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [
   HandlerOnLeave,
    (ev) => matchManager.handlePlayerLeave(ev),
   (ev) => anticheatCps.onPlayerLeave(ev),
   (ev) => autoSmelt.onPlayerLeave(ev),
   (ev) => axe.onPlayerLeave(ev),
   (ev) => enchant.onPlayerLeave(ev),
   (ev) => knockback.onPlayerLeave(ev),
   (ev) => tntInstant.onPlayerLeave(ev),
];

world.afterEvents.playerLeave.subscribe((event) => {
   runEventHandlers('PlayerLeave', afterEvents, event);
});
