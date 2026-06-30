import { system } from '@minecraft/server';
import { HandlerCustomCommands } from '../commands/function.js';
import { runEventHandlers } from '../shared/Util.js';
import { renderBoard } from '../features/leaderboard/LeaderboardManager.js';
import { HandlerStartupStats, HandlerStartupTeam } from '../features/team/TeamManager.js';

const startupHandlers = [HandlerCustomCommands];

system.beforeEvents.startup.subscribe((init) => {
   runEventHandlers('Startup', startupHandlers, init);
});

system.run(renderBoard);
system.run(HandlerStartupTeam);
system.run(HandlerStartupStats);
