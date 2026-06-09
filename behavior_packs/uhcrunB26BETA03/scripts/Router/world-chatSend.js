import { world } from '@minecraft/server';
import { HandlerOnChat } from '../Manager/TeamManager.js';
import { runEventHandlers } from '../plugin/Util.js';

const beforeEvents = [HandlerOnChat];

world.beforeEvents.chatSend.subscribe((event) => {
   runEventHandlers('ChatSend', beforeEvents, event);
});
