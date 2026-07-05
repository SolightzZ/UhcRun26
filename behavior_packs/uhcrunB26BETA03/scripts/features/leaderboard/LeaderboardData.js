import { world } from '@minecraft/server';
import { TEAMS } from '../../constants/game.js';
import { lbCache, MAX_TEAMS } from '../../constants/leaderboard.js';
import { logError } from '../../shared/Util.js';
import { playerCache, playerTeamCache } from '../cache/State_Cache.js';
import { resolveParticipantName } from '../stats/StatsManager.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { getPlayersByTeam } from '../team/TeamActions.js';
import { buildTeamText } from './LeaderboardFormat.js';

function buildScoreLookup(obj) {
   const map = new Map();

   if (!obj) return map;

   try {
      for (const p of obj.getParticipants()) {
         const name = resolveParticipantName(p);
         if (name) map.set(name, obj.getScore(p));
      }
   } catch (error) {
      logError('LeaderboardData', 'buildScoreLookup error', error);
   }
   return map;
}

export function getStats() {
   const killsObj = world.scoreboard?.getObjective('uhc_kills');
   const deathsObj = world.scoreboard?.getObjective('uhc_deaths');

   const killsLookup = buildScoreLookup(killsObj);
   const deathsLookup = buildScoreLookup(deathsObj);

   if (!killsLookup.size && !deathsLookup.size) {
      return new Map();
   }

   const allNames = new Set();
   for (const k of killsLookup.keys()) allNames.add(k);
   for (const k of deathsLookup.keys()) allNames.add(k);

   const playerStatsMap = new Map();

   for (const name of allNames) {
      const killCount = killsLookup.get(name) ?? 0;
      const deathCount = deathsLookup.get(name) ?? 0;
      if (!killCount && !deathCount) continue;

      let teamId = null;
      for (const [uuid, p] of playerCache) {
         if (p?.name === name) {
            teamId = playerTeamCache.get(uuid);
            break;
         }
      }

      const teamInfo = teamId ? TEAM_LOOKUP.get(teamId) : null;
      const teamLabel = teamInfo ? teamInfo.color + teamInfo.name : null;

      playerStatsMap.set(name, {
         kills: killCount,
         deaths: deathCount,
         teamId,
         teamLabel,
      });
   }

   return playerStatsMap;
}

function getRuntimeTeamList() {
   if (!TEAMS?.length) return [];

   const teamKillLookup = buildScoreLookup(world.scoreboard?.getObjective('uhc_teamkills'));

   const teamList = TEAMS.map((teamInfo, i) => ({
      name: teamInfo.color + teamInfo.name,
      kills: teamKillLookup.get(teamInfo.color + teamInfo.name) ?? 0,
      members: getPlayersByTeam(teamInfo.id).length,
      order: i,
   }));

   teamList.sort((a, b) => {
      if (b.kills !== a.kills) return b.kills - a.kills;
      return a.order - b.order;
   });

   if (teamList.length > MAX_TEAMS) teamList.length = MAX_TEAMS;
   return teamList;
}

export function getTeamText() {
   const teamList = getRuntimeTeamList();

   let teamHash = '';
   for (const team of teamList) {
      teamHash += `${team.name}${team.kills}${team.members}${team.order}`;
   }

   if (teamHash === lbCache.lastTeamHash && lbCache.cachedTeamText) {
      return lbCache.cachedTeamText;
   }

   lbCache.cachedTeamText = buildTeamText(teamList);
   lbCache.lastTeamHash = teamHash;
   return lbCache.cachedTeamText;
}
