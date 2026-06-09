//ตัวจัดการหลัก: events, initialization, victory
import { system, world } from '@minecraft/server';
import { COMPASS_ITEM, getSafeDimension, setAdventure, setSpectator } from '../plugin/Util.js';
import utilUmm from '../system/UtilUhcMatchManager.js';
import { CONFIG, TEAMS } from './UtilTeamManager.js';

import {
   allPlayersCache,
   allPlayersCacheIds,
   playerCache,
   playerTeamCache,
   uhcPlayerIds,
   uhcPlayersCache,
} from './State_Cache.js';
import {
   isGameRunning,
   setKdHistoryObj,
   setTeamKillObj,
   setUhcDeathsObj,
   setUhcKillsObj,
} from './State_Game.js';
import { REVIVE_ITEM_ID } from './State_Revive.js';
import {
   deathLocation,
   playerStats,
   setAliveTeamDirtyHandler,
   TEAM_INDEX_MAP,
   TEAM_LOOKUP,
   teamCounts,
   teamPlayerIndex,
   teamStats,
} from './State_Team.js';
import { createLoc } from './State_Util.js';

import {
   checkAllCaches,
   clearAllCaches,
   clearAllCachesIncludingStats,
   purgePlayerCacheOnLeave,
   rebuildTeamRuntimeState,
   refreshPlayerCaches,
} from './CacheManager.js';
import { handleDeath } from './DeathManager.js';
import { AdminMenu } from './MenuManager_Admin.js';
import { openMainMenu, teleportToSpawn } from './MenuManager_Main.js';
import { showTeleportForm, tpa } from './MenuManager_Teleport.js';
import { cancelReviveForPlayer } from './ReviveManager_Core.js';
import { onUseReviveItem } from './ReviveManager_UI.js';
import { ensureObjective, refreshScoreboardUI, updateSidebar } from './ScoreboardManager.js';
import { resetAnnouncer, scheduleSaveStats } from './StatsManager.js';
import {
   clearAllTaguhcAndDynamicProperty,
   clearAllTeams,
   getCachedPlayers,
   getPlayersByTeam,
   getPlayerTeam,
   setTeam,
} from './TeamActions.js';

export { getPlayerTeam, refreshPlayerCaches, refreshScoreboardUI };
export function getTeams() {
   return TEAMS;
}
export function getTeamInfo(teamId) {
   return TEAM_LOOKUP.get(teamId) ?? null;
}
export { getCachedPlayers as getAllPlayers };
export const getUhcPlayers = () => uhcPlayersCache;
export { getKdHistoryObjective, getTeamKillObjective, setGameRunningState } from './State_Game.js';
export {
   AdminMenu,
   checkAllCaches,
   clearAllCaches,
   clearAllCachesIncludingStats,
   clearAllTaguhcAndDynamicProperty,
   clearAllTeams,
   getPlayersByTeam,
   openMainMenu,
   setAliveTeamDirtyHandler as registerAliveTeamDirtyHandler,
   resetAnnouncer,
   showTeleportForm,
   teleportToSpawn,
   tpa,
};

export function isPlayerUhcId(id) {
   return uhcPlayerIds.has(id);
}

// รีเซ็ต nametag ผู้เล่นเป็นชื่อปกติทีละ 3 คนต่อ tick
export function clearAllPlayerNametags() {
   let index = 0;
   const task = system.runInterval(() => {
      const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
      const total = players.length;
      if (index >= total) {
         system.clearRun(task);
         console.warn('Clear All Player Nametags');
         return;
      }
      const batch = players.slice(index, index + 3);
      index += batch.length;
      for (let bi = 0, bLen = batch.length; bi < bLen; bi++) {
         const p = batch[bi];
         if (!p?.isValid) continue;
         if (p.nameTag === p.name) continue;
         p.nameTag = p.name;
      }
   }, 1);
}

//แสดงข้อความชนะในแชททั้งเซิฟ
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

   world.sendMessage(
      `\n§7=======================================\n§6      UHC RUN26 MATCH FINISHED\n§7=======================================\n\n§eVICTORY ${teamInfo.color}${teamInfo.name}§r\n\n§ePLAYERS\n${playerLine}\n§eSTATS\n§7 » Total Kills: §c${teamStat.kills}\n§7 » Match Time: §e${minutes}m ${seconds}s\n\n§9 » Sleeplite: discord.gg/gtqfbmvTJK\n\n§7=======================================\n\n`,
   );
}

//Event Handlers

//จัดการเมื่อผู้เล่นตาย
export function HandlerOnDeath(ev) {
   const dead = ev.deadEntity;
   if (!dead) return;
   if (dead.typeId !== 'minecraft:player') return;
   if (!dead.isValid) return;
   handleDeath(dead);
}

//จัดการเมื่อผู้เล่น spawn (เข้าหรือเกิดใหม่)
export function HandlerOnSpawn(ev) {
   const player = ev.player;
   if (!player) return;
   const id = player.id;
   playerCache.set(id, player);

   const cachedTeamId = playerTeamCache.get(id);
   const dynamicProp = player.getDynamicProperty(CONFIG.key);
   const propTeamId = typeof dynamicProp === 'string' ? dynamicProp : null;
   const spawnTeamId = cachedTeamId ?? propTeamId;

   const spawnPs = playerStats.get(id) ?? { kills: 0, deaths: 0 };
   spawnPs.name = player.name;
   if (spawnTeamId) spawnPs.teamId = spawnTeamId;
   playerStats.set(id, spawnPs);

   if (!allPlayersCacheIds.has(id)) {
      allPlayersCache.push(player);
      allPlayersCacheIds.add(id);
   }

   if (player.hasTag('uhc') && !uhcPlayerIds.has(id)) {
      uhcPlayersCache.push(player);
      uhcPlayerIds.add(id);
   }

   // ถ้าไม่ใช่ initialSpawn ให้เทเลพอร์ตไปที่ตายครั้งล่าสุด
   if (!ev.initialSpawn) {
      const loc = deathLocation.get(id);
      if (loc) {
         const dimension = getSafeDimension(player);
         player.teleport(createLoc(loc.x + 0.5, loc.y, loc.z + 0.5), { dimension });
      }
   }

   const dynamicTeam = propTeamId ?? cachedTeamId;

   // ถ้ากำลังเล่นเกมและไม่มี uhc tag -> spectator
   if (isGameRunning && !player.hasTag('uhc')) {
      setSpectator(player);
      player.addEffect('conduit_power', 1, { amplifier: 255, showParticles: false });
      scheduleSaveStats();
      return;
   }

   // initialSpawn ตอนเกมยังไม่เริ่ม -> ไป spawn
   if (ev.initialSpawn && !isGameRunning) {
      teleportToSpawn(player);
      setAdventure(player);
      utilUmm.playerSetupClearItemsKeepCompass(player);
   }

   if (!dynamicTeam) {
      scheduleSaveStats();
      return;
   }

   // เพิ่มผู้เล่นเข้า team runtime ถ้ายังไม่มี
   const inCache = playerTeamCache.has(id);

   if ((!inCache && !isGameRunning) || player?.hasTag('uhc')) {
      const before = teamCounts.get(dynamicTeam) ?? 0;
      teamCounts.set(dynamicTeam, before + 1);
      teamPlayerIndex.get(dynamicTeam)?.add(id);
      updateSidebar(dynamicTeam);
   }

   setTeam(player, dynamicTeam, { scheduleSave: false });
   scheduleSaveStats();
}

//จัดการเมื่อผู้เล่นออก
export function HandlerOnLeave(ev) {
   const id = ev.playerId;
   if (!id) return;
   cancelReviveForPlayer(id);
   purgePlayerCacheOnLeave(id);
}

//จัดการแชท: แปลงเป็น chat ทีม (ไม่มี ! prefix)
export function HandlerOnChat(ev) {
   const player = ev.sender;
   if (!player || !player.isValid) return;
   const message = ev.message;
   if (!message) return;
   const trimmed = message.trim();
   if (trimmed.length === 0) return;
   if (trimmed[0] === '!') return;
   const teamId = playerTeamCache.get(player.id);
   if (!teamId) return;
   const teamInfo = TEAM_LOOKUP.get(teamId);
   if (!teamInfo) return;
   const teamIndexRaw = TEAM_INDEX_MAP.get(teamId);
   const teamIndex = (teamIndexRaw ?? -1) + 1;
   ev.cancel = true;
   const formattedMessage = `[${teamIndex}] ${teamInfo.color}${player.name}§r: ${trimmed}`;
   world.sendMessage(formattedMessage);
}

//จัดการการใช้ไอเทม revive / compass
export function HandlerRevive(ev) {
   const { source, itemStack } = ev;

   if (!source?.isValid) return;
   const itemId = itemStack?.typeId;

   if (itemId === REVIVE_ITEM_ID) {
      system.run(() => onUseReviveItem(source));
      return;
   }

   if (itemId !== COMPASS_ITEM) return;
   if (!source.hasTag(CONFIG.adminTag) && source.hasTag('uhc')) return;
   system.run(() => openMainMenu(source));
}

// เริ่มต้น: แคชของผู้เล่น + กระดานคะแนน
system.run(() => {
   try {
      const players = world.getPlayers();
      for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
         const p = players[pi];
         if (!p?.isValid) continue;
         playerCache.set(p.id, p);
      }

      rebuildTeamRuntimeState(players);
      refreshScoreboardUI();
      console.warn('[TeamManager] Player cache + scoreboard initialized.');
   } catch (error) {
      console.error('[TeamManager] Failed to initialize player cache:', error);
   }
});

// เริ่มต้น: วัตถุประสงค์ของกระดานคะแนน
system.run(() => {
   try {
      if (!world.scoreboard) return;
      setKdHistoryObj(ensureObjective('kdhistory', 'KD History'));
      setTeamKillObj(ensureObjective('uhc_teamkills', 'Team Kills'));
      setUhcKillsObj(ensureObjective('uhc_kills', 'Player Kills'));
      setUhcDeathsObj(ensureObjective('uhc_deaths', 'Player Deaths'));
      console.warn('[TeamManager] Scoreboard objectives initialized.');
   } catch (error) {
      console.error('[TeamManager] Failed to initialize scoreboard objectives:', error);
   }
});

// โหลด stats จาก Dynamic Property (JSON string)
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

// เริ่มต้น: สถิติจากคุณสมบัติไดนามิก
system.run(() => {
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

      console.warn('[TeamManager] Stats loaded from dynamic properties.');
   } catch (error) {
      console.error('[TeamManager] Failed to load stats from dynamic properties:', error);
   }
});

// แปลง JSON string value แบบปลอดภัย (Map ถูก serialize เป็น object)
function safeParseDynamicMap(rawValue, label) {
   if (typeof rawValue !== 'string' || rawValue.length === 0) return null;
   try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
         console.warn(`[UHC] Ignored invalid ${label} dynamic property payload.`);
         return null;
      }
      return parsed;
   } catch (error) {
      console.error(`[UHC] Failed to parse ${label} dynamic property: ` + error);
      return null;
   }
}
