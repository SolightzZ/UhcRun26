import { world } from '@minecraft/server';
import { HandlerchatSendCaches, HandlerOnChat } from '../Manager/TeamManager.js';
import border from '../system/border.js';

const beforeEvents = [HandlerOnChat, HandlerchatSendCaches, (ev) => border.handleChatSend(ev)];

world.beforeEvents.chatSend.subscribe((event) => {
    try {
        for (const handler of beforeEvents) {
            handler(event);
        }
    } catch (error) {
        console.error('[ChatSend] error:', error.message);
    }
});
