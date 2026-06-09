import { world } from '@minecraft/server';
import { HandlerOnHurt } from '../Manager/DeathManager.js';
import knockback from '../plugin/knockback/Controller.js';
import { runEventHandlers } from '../plugin/Util.js';

const afterEvents = [HandlerOnHurt, (ev) => knockback.onEntityHurt(ev)];

world.afterEvents.entityHurt.subscribe((event) => {
   runEventHandlers('EntityHurt', afterEvents, event);
});
