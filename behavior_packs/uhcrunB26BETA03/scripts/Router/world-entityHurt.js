import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerOnHurt } from '../Manager/DeathManager.js';
import knockback from '../plugin/knockback/Controller.js';

const afterEvents = [HandlerOnHurt, (ev) => knockback.onEntityHurt(ev)];

world.afterEvents.entityHurt.subscribe((event) => {
    runEventHandlers('EntityHurt', afterEvents, event);
});
