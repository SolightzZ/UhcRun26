import { system } from '@minecraft/server';
import { HandlerCustomCommands } from '../commands/CustomCommands.js';
import { renderBoard } from '../features/leaderboard/LeaderboardManager.js';
import { HandlerStartupStats, HandlerStartupTeam } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';

const startupHandlers = [HandlerCustomCommands];

system.beforeEvents.startup.subscribe((init) => {
   runEventHandlers(startupHandlers, init);
});

system.run(renderBoard);
system.run(HandlerStartupTeam);
system.run(HandlerStartupStats);
