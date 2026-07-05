import { world } from '@minecraft/server';
import { refreshLeaderboard } from '../features/leaderboard/LeaderboardManager.js';
import MatchManager from '../features/match/MatchManager.js';
import { recordPlayerName, recordScoreboardId } from '../features/stats/StatsManager.js';
import { HandlerOnSpawn } from '../features/team/TeamManager.js';
import anticheatCps from '../plugin/anticheat-cps/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [
   (ev) => {
      if (ev.player) {
         recordPlayerName(ev.player);
         recordScoreboardId(ev.player);
      }
   },

   HandlerOnSpawn,
   (ev) => anticheatCps.onPlayerSpawn(ev),
   (ev) => MatchManager.handlePlayerSpawn(ev),
   (ev) => {
      if (ev.player) refreshLeaderboard();
   },
];

world.afterEvents.playerSpawn.subscribe((event) => {
   runEventHandlers(afterEvents, event);
});
