import { system, world } from '@minecraft/server';
import { CONFIG, TEAMS } from '../../constants/game.js';
import { enqueueAddEffect } from '../../shared/AddEffectBatcher.js';
import { enqueueBroadcast } from '../../shared/MessageBatcher.js';
import { COMPASS_ITEM, createLoc, freeLoc, getSafeDimension, logError, logWarn, setAdventure, setSpectator } from '../../shared/Util.js';
import { openMainMenu } from '../../ui/menu/MenuMain.js';
import { onUseReviveItem } from '../../ui/revive/ReviveUI.js';
import { purgePlayerCacheOnLeave, rebuildTeamRuntimeState } from '../cache/CacheManager.js';
import { allPlayersCache, playerCache, playerTeamCache, uhcPlayerIds, uhcPlayersCache } from '../cache/State_Cache.js';
import MatchUtil from '../match/MatchUtil.js';
import { isGameRunning, setKdHistoryObj, setTeamKillObj, setUhcDeathsObj, setUhcKillsObj } from '../match/State_Game.js';
import { cancelReviveForPlayer } from '../revive/ReviveManager.js';
import { REVIVE_ITEM_ID } from '../revive/State_Revive.js';
import { handleDeath } from '../death/DeathManager.js';
import { ensureObjective, refreshScoreboardUI } from '../stats/ScoreboardManager.js';
import { scheduleSaveStats } from '../stats/StatsManager.js';
import { addToTeamIndex, deathLocation, playerStats, setPlayerStats, TEAM_LOOKUP, teamStats } from './State_Team.js';
import { getCachedPlayers, setTeam } from './TeamActions.js';
import { teleportToSpawn } from './TeleportManager.js';

function clearAllPlayerNametags() {
   let index = 0;
   const task = system.runInterval(() => {
      const players = getCachedPlayers();
      const total = players.length;
      if (index >= total) {
         system.clearRun(task);
         logWarn('TeamManager', 'Clear All Player Nametags');
         return;
      }
      const end = Math.min(index + 3, total);
      for (let pi = index; pi < end; pi++) {
         const p = players[pi];
         if (!p?.isValid) continue;
         if (p.nameTag === p.name) continue;
         p.nameTag = p.name;
      }
      index = end;
   }, 3);
}

export function showVictoryMessage(winnerTeamId, uhcTick = 0) {
   const teamInfo = TEAM_LOOKUP.get(winnerTeamId);
   if (!teamInfo) return;

   const teamStat = teamStats.get(winnerTeamId) ?? { kills: 0, deaths: 0 };
   let playerLine = '';
   const psEntries = Array.from(playerStats.entries());
   for (let pi = 0, pLen = psEntries.length; pi < pLen; pi++) {
      const [playerId, ps] = psEntries[pi];
      const teamId = ps.teamId ?? playerTeamCache.get(playerId);
      if (teamId !== winnerTeamId) continue;
      const onlinePlayer = playerCache.get(playerId);
      const name = onlinePlayer?.isValid ? onlinePlayer.name : (ps.name ?? playerId);
      playerLine += `${teamInfo.color}${name} §7- §c${ps.kills} Kill\n`;
   }
   if (!playerLine) playerLine = '§7No players\n';

   const totalSeconds = uhcTick;
   const minutes = Math.floor(totalSeconds / 60);
   const seconds = totalSeconds % 60;

   enqueueBroadcast(
      `\n§7=======================================\n§6      UHC RUN26 MATCH FINISHED\n§7=======================================\n\n§eVICTORY ${teamInfo.color}${teamInfo.name}§r\n\n§ePLAYERS\n${playerLine}\n§eSTATS\n§7 » Total Kills: §c${teamStat.kills}\n§7 » Match Time: §e${minutes}m ${seconds}s\n\n§9 » Sleeplite: discord.gg/gtqfbmvTJK\n\n§7=======================================\n\n`,
   );
}

export function HandlerOnDeath(ev) {
   const dead = ev.deadEntity;
   if (!dead) return;
   if (dead.typeId !== 'minecraft:player') return;
   if (!dead.isValid) return;
   handleDeath(dead);
}

export function HandlerOnSpawn(ev) {
   const player = ev.player;
   if (!player) return;
   const id = player.id;
   playerCache.set(id, player);

   const cachedTeamId = playerTeamCache.get(id);
   const dynamicProp = player.getDynamicProperty(CONFIG.key);
   const propTeamId = typeof dynamicProp === 'string' ? dynamicProp : null;
   const spawnTeamId = cachedTeamId ?? propTeamId;

   const hasStats = playerStats.size > 0;

   const spawnPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
   spawnPs.name = player.name;
   if (spawnTeamId) spawnPs.teamId = spawnTeamId;
   setPlayerStats(id, spawnPs);

   if (!playerCache.has(id)) {
      allPlayersCache.push(player);
      playerCache.set(id, player);
   }

   if (!isGameRunning && uhcPlayerIds.has(id)) {
      player.removeTag('uhc');
      uhcPlayerIds.delete(id);
   }

   if (player.hasTag('uhc') && !uhcPlayerIds.has(id)) {
      uhcPlayersCache.push(player);
      uhcPlayerIds.add(id);
   }

   if (!ev.initialSpawn) {
      const loc = deathLocation.get(id);
      if (loc) {
         const dimension = getSafeDimension(player);
         const rLoc = createLoc(loc.x + 0.5, loc.y, loc.z + 0.5);
         player.teleport(rLoc, { dimension });
         freeLoc(rLoc);
      }
   }

   const dynamicTeam = propTeamId ?? cachedTeamId;

   if (isGameRunning && !uhcPlayerIds.has(player.id)) {
      setSpectator(player);
      enqueueAddEffect(player, 'conduit_power', 1, { amplifier: 255, showParticles: false });
      scheduleSaveStats();
      return;
   }

   if (ev.initialSpawn && !isGameRunning) {
      teleportToSpawn(player);
      setAdventure(player);
      MatchUtil.playerSetupClearItemsKeepCompass(player);
   }

   if (!dynamicTeam) {
      scheduleSaveStats();
      return;
   }

   const inCache = playerTeamCache.has(id);

   if ((!inCache && !isGameRunning && hasStats) || uhcPlayerIds.has(player.id)) {
      addToTeamIndex(dynamicTeam, id);
   }

   if (hasStats && (inCache || isGameRunning || uhcPlayerIds.has(player.id))) {
      setTeam(player, dynamicTeam, { scheduleSave: false });
      scheduleSaveStats();
   } else {
      for (let ti = 0, tLen = TEAMS.length; ti < tLen; ti++) {
         const tid = TEAMS[ti].id;
         if (player.hasTag(tid)) player.removeTag(tid);
      }
      player.setDynamicProperty(CONFIG.key, undefined);
      if (player.nameTag !== player.name) player.nameTag = player.name;
   }
}

export function HandlerOnLeave(ev) {
   const id = ev.playerId;
   if (!id) return;
   cancelReviveForPlayer(id);
   scheduleSaveStats();
   purgePlayerCacheOnLeave(id);
}

export function HandlerRevive(ev) {
   const { source, itemStack } = ev;

   if (!source?.isValid) return;
   const itemId = itemStack?.typeId;

   if (itemId === REVIVE_ITEM_ID) {
      system.run(() => onUseReviveItem(source));
      return;
   }

   if (itemId !== COMPASS_ITEM) return;
   if (!source.hasTag(CONFIG.adminTag) && uhcPlayerIds.has(source.id)) return;
   system.run(() => openMainMenu(source));
}

export function HandlerStartupTeam() {
   try {
      const players = getCachedPlayers();
      for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
         const p = players[pi];
         if (!p?.isValid) continue;
         playerCache.set(p.id, p);
      }

      rebuildTeamRuntimeState(players);
      refreshScoreboardUI();
      logWarn('TeamManager', 'Player cache + scoreboard initialized.');

      if (world.scoreboard) {
         setKdHistoryObj(ensureObjective('kdhistory', 'KD History'));
         setTeamKillObj(ensureObjective('uhc_teamkills', 'Team Kills'));
         setUhcKillsObj(ensureObjective('uhc_kills', 'Player Kills'));
         setUhcDeathsObj(ensureObjective('uhc_deaths', 'Player Deaths'));
         logWarn('TeamManager', 'Scoreboard objectives initialized.');
      }
   } catch (error) {
      logError('TeamManager', 'Failed to initialize player cache', error);
   }
}

function loadStatsFromWorld(key, map, label, validateKey, mapper) {
   const raw = world.getDynamicProperty(key);
   const parsed = safeParseDynamicMap(raw, label);
   if (!parsed) return;
   const entries = Object.entries(parsed);
   for (let ei = 0, eLen = entries.length; ei < eLen; ei++) {
      const [k, v] = entries[ei];
      if (!v) continue;
      if (validateKey && !validateKey(k)) continue;
      map.set(k, mapper(v));
   }
}

export function HandlerStartupStats() {
   try {
      loadStatsFromWorld(
         'uhc_teamStats',
         teamStats,
         'uhc_teamStats',
         (k) => teamStats.has(k),
         (v) => ({
            kills: Number.isFinite(Number(v.kills)) ? Number(v.kills) : 0,
            deaths: Number.isFinite(Number(v.deaths)) ? Number(v.deaths) : 0,
         }),
      );

      loadStatsFromWorld(
         'uhc_playerStats',
         playerStats,
         'uhc_playerStats',
         (k) => typeof k === 'string' && k.length > 0,
         (v) => ({
            kills: Number.isFinite(Number(v.kills)) ? Number(v.kills) : 0,
            deaths: Number.isFinite(Number(v.deaths)) ? Number(v.deaths) : 0,
            name: typeof v.name === 'string' ? v.name : undefined,
            teamId: typeof v.teamId === 'string' ? v.teamId : undefined,
         }),
      );

      logWarn('TeamManager', 'Stats loaded from dynamic properties.');
   } catch (error) {
      logError('TeamManager', 'Failed to load stats from dynamic properties', error);
   }
}

function safeParseDynamicMap(rawValue, label) {
   if (typeof rawValue !== 'string' || rawValue.length === 0) return null;
   try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
         logWarn('UHC', 'Ignored invalid ' + label + ' dynamic property payload.');
         return null;
      }
      return parsed;
   } catch (error) {
      logError('UHC', 'Failed to parse ' + label + ' dynamic property', error);
      return null;
   }
}
