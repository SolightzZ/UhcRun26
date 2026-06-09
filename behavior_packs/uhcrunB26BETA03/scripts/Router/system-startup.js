import { system } from '@minecraft/server';
import { HandlerCustomCommands } from '../customCommand/command.js';
import { runEventHandlers } from '../plugin/Util.js';

const startupHandlers = [HandlerCustomCommands];

system.beforeEvents.startup.subscribe((init) => {
   runEventHandlers('Startup', startupHandlers, init);
});
