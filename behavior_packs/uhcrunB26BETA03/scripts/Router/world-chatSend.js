import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerchatSendCaches, HandlerOnChat } from '../Manager/TeamManager.js';

const beforeEvents = [HandlerOnChat, HandlerchatSendCaches];

world.beforeEvents.chatSend.subscribe((event) => {
    runEventHandlers('ChatSend', beforeEvents, event);
});
