import { system } from '@minecraft/server';
import { HandlerCustomCommands } from '../customCommand/command.js';

const startupHandlers = [HandlerCustomCommands];

system.beforeEvents.startup.subscribe((init) => {
    try {
        for (const handler of startupHandlers) {
            handler(init);
        }
    } catch (error) {
        console.error('[Startup] error:', error.message);
    }
});
