import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerOnLeave } from '../Manager/TeamManager.js';
import umm from '../system/UhcMatchManager.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';
import enchant from '../plugin/enchant/Controller.js';
import knockback from '../plugin/knockback/Controller.js';
import tntInstant from '../plugin/tnt-instant/Controller.js';

const afterEvents = [
    HandlerOnLeave,
    (ev) => umm.handlePlayerLeave(ev),
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
