import { world } from '@minecraft/server';
import enchant from '../plugin/enchant/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => enchant.onPlayerHotbarSelectedSlotChange(ev)];

world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
   runEventHandlers('PlayerHotbarSelectedSlotChange', afterEvents, event);
});
