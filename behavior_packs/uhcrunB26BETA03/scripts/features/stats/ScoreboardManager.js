import { DisplaySlotId, system, world } from '@minecraft/server';
import { logError } from '../../shared/Util.js';

export function ensureObjective(id, displayName) {
   try {
      let obj = world.scoreboard.getObjective(id);
      if (!obj) obj = world.scoreboard.addObjective(id, displayName);
      return obj;
   } catch (error) {
      logError('Scoreboard', 'Failed to ensure objective ' + id, error);
      return null;
   }
}

let _refreshThrottleTask = null;

export function refreshScoreboardUI() {
   if (_refreshThrottleTask !== null) return;
   _refreshThrottleTask = system.runTimeout(() => {
      _refreshThrottleTask = null;
      try {
         const teamKills = ensureObjective('uhc_teamkills', 'Team Kills');
         const deaths = ensureObjective('uhc_deaths', 'Player Deaths');
         const kills = ensureObjective('uhc_kills', 'Player Kills');

         world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: teamKills });
         world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.BelowName, { objective: deaths });
         world.scoreboard.setObjectiveAtDisplaySlot(DisplaySlotId.List, { objective: kills });
      } catch (error) {
         logError('Scoreboard', 'Failed to refresh scoreboard UI', error);
      }
   }, 2);
}
