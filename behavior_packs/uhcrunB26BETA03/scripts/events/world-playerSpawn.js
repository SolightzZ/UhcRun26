import { world } from '@minecraft/server';
import matchManager from '../features/match/MatchManager.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import { HandlerOnSpawn } from '../features/team/TeamManager.js';
import { runEventHandlers } from '../shared/Util.js';
import { recordPlayerName, recordScoreboardId } from '../features/stats/StatsManager.js';
import { refreshLeaderboard } from '../features/leaderboard/LeaderboardManager.js';

const afterEvents = [
   (ev) => { if (ev.player) { recordPlayerName(ev.player); recordScoreboardId(ev.player); } },
   HandlerOnSpawn,
   (ev) => anticheatCps.onPlayerSpawn(ev),
   (ev) => matchManager.handlePlayerSpawn(ev),
   (ev) => { if (ev.player) refreshLeaderboard(); },
];

world.afterEvents.playerSpawn.subscribe((event) => {
   runEventHandlers('PlayerSpawn', afterEvents, event);
});
