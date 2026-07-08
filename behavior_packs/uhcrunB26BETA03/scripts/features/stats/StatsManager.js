import { system, world } from '@minecraft/server';
import { DP_SIZE_LIMIT, TEAMS } from '../../constants/game.js';
import { logError, logWarn, utf8ByteLength } from '../../shared/Util.js';
import { setStatsDirty, setStatsSaveTask, statsDirty, statsSaveTask } from '../match/State_Game.js';
import { clearPlayerStats, playerStats, setTeamStats, teamStats } from '../team/State_Team.js';

const _sbIdToUuid = new Map();
const LEGACY_PLAYER_MAP_KEY = 'PlayerDynamic';
let _legacyMigrated = false;

function migrateLegacyPlayerDynamic() {
   if (_legacyMigrated) return;
   _legacyMigrated = true;
   try {
      const raw = world.getDynamicProperty(LEGACY_PLAYER_MAP_KEY);
      if (!raw) return;
      const names = JSON.parse(raw);
      let migrated = 0;
      for (const [id, name] of Object.entries(names)) {
         const existing = playerStats.get(id);
         if (existing) {
            if (!existing.name || existing.name !== name) {
               existing.name = name;
               migrated++;
            }
         } else {
            playerStats.set(id, { kills: 0, deaths: 0, name: name, teamId: null });
            migrated++;
         }
      }
      world.setDynamicProperty(LEGACY_PLAYER_MAP_KEY, undefined);
      if (migrated > 0) {
         logWarn('Stats', `Migrated ${migrated} entries from PlayerDynamic → playerStats, legacy key cleared`);
      }
   } catch (err) {
      logError('Stats', 'Migration of PlayerDynamic failed, leaving legacy key intact', err);
   }
}

export function recordPlayerName(player) {
   if (!player?.id || !player?.name) return;
   const ps = playerStats.get(player.id);
   if (ps && ps.name === player.name) return;
   const existing = ps ?? { kills: 0, deaths: 0 };
   existing.name = player.name;
   playerStats.set(player.id, existing);
   scheduleSaveStats();
}

function getPlayerDisplayName(playerId) {
   if (!playerId) return null;
   return playerStats.get(playerId)?.name || null;
}

export function recordScoreboardId(player) {
   if (!player?.scoreboardIdentity?.id) return;
   _sbIdToUuid.set(player.scoreboardIdentity.id, player.id);
}

export function resolveParticipantName(participant) {
   if (!participant) return null;

   const dn = participant.displayName;
   const isNumericId = typeof dn === 'string' && /^-?\d+$/.test(dn);
   const isUuid = typeof dn === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dn);

   if (dn && typeof dn === 'string' && !isNumericId && !isUuid) return dn;

   if (isUuid) {
      const stored = getPlayerDisplayName(dn);
      if (stored) return stored;
   }

   try {
      const entity = participant.getEntity();
      if (entity?.name) return entity.name;
   } catch {}

   const uuid = _sbIdToUuid.get(participant.id);
   if (uuid) {
      const stored = getPlayerDisplayName(uuid);
      if (stored) return stored;
   }

   return dn || null;
}

function clearStatsDynamicProperties() {
   world.setDynamicProperty('uhc_teamStats', undefined);
   world.setDynamicProperty('uhc_playerStats', undefined);
}

export function resetAllStats() {
   for (const team of TEAMS) {
      setTeamStats(team.id, { kills: 0, deaths: 0 });
   }

   clearPlayerStats();
   clearStatsDynamicProperties();
}

export function scheduleSaveStats() {
   setStatsDirty(true);
   if (statsSaveTask !== null) return;
   setStatsSaveTask(system.runTimeout(runSaveStats, 200));
}

function runSaveStats() {
   setStatsSaveTask(null);
   if (!statsDirty) return;
   setStatsDirty(false);
   saveTeamStats();
   savePlayerStats();
   if (statsDirty) {
      scheduleSaveStats();
   }
}

export function flushStatsNow() {
   if (!statsDirty) return;
   if (statsSaveTask !== null) {
      system.clearRun(statsSaveTask);
      setStatsSaveTask(null);
   }
   runSaveStats();
}

function safeStringify(data, label) {
   try {
      return JSON.stringify(data);
   } catch (error) {
      logError('Stats', `${label} data corrupted, skipping save`, error);
      return null;
   }
}

function saveStatsToWorld(key, map, label) {
   try {
      const data = Object.fromEntries(map);
      const json = safeStringify(data, label);
      if (!json) return;
      const bytes = utf8ByteLength(json);
      if (bytes > DP_SIZE_LIMIT) {
         logWarn('Stats', `${label} JSON ${bytes}B exceeds DP size limit, skipping save`);
         return;
      }
      world.setDynamicProperty(key, json);
   } catch (error) {
      logError('Stats', `saveStats ${label} failed`, error);
   }
}

function saveTeamStats() {
   saveStatsToWorld('uhc_teamStats', teamStats, 'teamStats');
}

function savePlayerStats() {
   saveStatsToWorld('uhc_playerStats', playerStats, 'playerStats');
}

