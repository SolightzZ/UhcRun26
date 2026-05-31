import { world } from '@minecraft/server';
import { runEventHandlers } from '../plugin/Util.js';
import { HandlerchatSendCaches, HandlerOnChat } from '../Manager/TeamManager.js';
import border from '../system/border.js';

const beforeEvents = [HandlerOnChat, HandlerchatSendCaches, (ev) => border.handleChatSend(ev)];

world.beforeEvents.chatSend.subscribe((event) => {
    runEventHandlers('ChatSend', beforeEvents, event);
});
