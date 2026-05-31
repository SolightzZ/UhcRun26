import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import enchant from '../plugin/enchant/Controller.js';

const afterEvents = [(ev) => enchant.onPlayerHotbarSelectedSlotChange(ev)];

world.afterEvents.playerHotbarSelectedSlotChange.subscribe((event) => {
    runEventHandlers('PlayerHotbarSelectedSlotChange', afterEvents, event);
});
