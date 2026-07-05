import { system, world } from '@minecraft/server';
import { DP_SIZE_LIMIT, TEAMS } from '../../constants/game.js';
import { enqueueBroadcast, enqueuePlayerMessage, enqueuePlayerSound, enqueuePlayerTitle } from '../../shared/MessageBatcher.js';
import { dynamicToast, logError, logWarn } from '../../shared/Util.js';
import { allPlayersCache, allPlayersCacheIds, hitRegistry, killStreak, multiKill, playerCache, playerTeamCache } from '../cache/State_Cache.js';
import { HIT_TIMEOUT_TICKS, MULTI_TIMEOUT_TICKS, firstBloodDone, kdHistoryObj, setFirstBloodDone, setStatsDirty, setStatsSaveTask, statsDirty, statsSaveTask } from '../match/State_Game.js';
import { TEAM_LOOKUP, clearPlayerStats, playerStats, setTeamStats, teamStats } from '../team/State_Team.js';

const MULTI_KILL_DATA = Object.freeze([
   null,
   { text: '§eKILL', sound: 'kill1' },
   { text: '§6DOUBLE KILL', sound: 'kill2' },
   { text: '§cTRIPLE KILL', sound: 'kill3' },
   { text: '§5QUADRA KILL', sound: 'kill4' },
   { text: '§4ACE', sound: 'kill5' },
]);

const PN_MAP_KEY = 'uhc_playerNames';
let _pnCache = null;

const _sbIdToUuid = new Map();

function loadPlayerNames() {
   if (_pnCache !== null) return _pnCache;
   try {
      const raw = world.getDynamicProperty(PN_MAP_KEY);
      _pnCache = raw ? JSON.parse(raw) : {};
   } catch {
      _pnCache = {};
   }
   return _pnCache;
}

function persistPlayerNames(map) {
   try {
      const json = JSON.stringify(map);
      world.setDynamicProperty(PN_MAP_KEY, json);
      _pnCache = map;
   } catch (error) {
      logError('Stats', 'Failed to persist player name map', error);
   }
}

export function recordPlayerName(player) {
   if (!player?.id || !player?.name) return;
   const map = loadPlayerNames();
   if (map[player.id] === player.name) return;
   map[player.id] = player.name;
   persistPlayerNames(map);
}

function getStoredPlayerName(id) {
   const map = loadPlayerNames();
   return map[id] || null;
}

export function recordScoreboardId(player) {
   if (!player?.scoreboardIdentity?.id) return;
   _sbIdToUuid.set(player.scoreboardIdentity.id, player.id);
}

export function resolveParticipantName(participant) {
   if (!participant) return null;

   const dn = participant.displayName;
   const isNumericId = typeof dn === 'string' && /^-?\d+$/.test(dn);

   if (dn && typeof dn === 'string' && !isNumericId) return dn;

   try {
      const entity = participant.getEntity();
      if (entity?.name) return entity.name;
   } catch {}

   const uuid = _sbIdToUuid.get(participant.id);
   if (uuid) {
      const stored = getStoredPlayerName(uuid);
      if (stored) return stored;
   }

   return dn || null;
}

function clearSbIdCache() {
   _sbIdToUuid.clear();
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

// ชะลอการบันทึก (Debounce Save) 60 ติ๊ก
export function scheduleSaveStats() {
   setStatsDirty(true);
   if (statsSaveTask !== null) return;
   setStatsSaveTask(system.runTimeout(runSaveStats, 60));
}

// บันทึกแบบอะตอมิก (Atomic Save): เขียนข้อมูลสถิติของทั้งทีมและผู้เล่นในติ๊กเดียวกัน
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

function safeStringify(data, label) {
   try {
      return JSON.stringify(data);
   } catch (error) {
      logError('Stats', `${label} data corrupted, skipping save`, error);
      return null;
   }
}

// คำนวณความยาวไบต์ UTF-8 ด้วย JavaScript แท้ (เนื่องจากไม่มี TextEncoder ในเครื่องมือรันไทม์ Bedrock JS)
function utf8ByteLength(str) {
   let len = 0;
   for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) len += 1;
      else if (code < 0x800) len += 2;
      else if (code < 0xd800 || code > 0xdfff) len += 3;
      else {
         i++;
         len += 4;
      }
   }
   return len;
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

function incrementPairHistory(killer, victim) {
   if (!kdHistoryObj) return;
   if (!killer) return;
   if (!victim) return;
   if (!killer.isValid) return;
   if (!victim.isValid) return;

   const killerName = killer.name;
   const victimName = victim.name;
   const historyKey = 'Kill: ' + killerName + ' | Victim : ' + victimName;

   kdHistoryObj.addScore(historyKey, 1);
}

function handleMultiKill(killer) {
   if (!killer) return;
   if (!killer.isValid) return;

   const id = killer.id;
   const now = system.currentTick;
   let data = multiKill.get(id);
   if (!data) {
      data = { count: 1, tick: now };
      multiKill.set(id, data);
   } else {
      if (now - data.tick > MULTI_TIMEOUT_TICKS) {
         data.count = 1;
         data.tick = now;
      } else {
         data.count = data.count + 1;
         data.tick = now;
      }
   }

   let count = data.count;
   if (count > 5) count = 5;

   const info = MULTI_KILL_DATA[count];
   if (!info) return;
   try {
      const safeName = killer.name.replace(/§./g, '');
      const message = info.text + ' §7| §f' + safeName;
      enqueueBroadcast(dynamicToast(message, 'textures/ui/icons/icon_multiplayer'));
      enqueueBroadcast(message);
      enqueuePlayerSound(killer, info.sound);
   } catch (error) {
      logError('Stats', 'Multi kill broadcast failed', error);
   }
}

function handleKillStreak(killer) {
   if (!killer) return;
   if (!killer.isValid) return;
   let current = killStreak.get(killer.id);
   if (current === undefined) {
      current = 0;
   }
   current = current + 1;
   killStreak.set(killer.id, current);
}

function handleFirstBlood(killer, victim) {
   if (!killer) return;
   if (!victim) return;
   if (!killer.isValid) return;
   if (!victim.isValid) return;
   if (firstBloodDone) return;

   setFirstBloodDone(true);
   try {
      const safeKiller = killer.name.replace(/§./g, '');
      const safeVictim = victim.name.replace(/§./g, '');
      const message = '§cFIRST BLOOD §7| ' + safeKiller + ' > §f' + safeVictim;
      enqueueBroadcast(dynamicToast(message, 'textures/ui/friend_glyph_desaturated'));
      enqueueBroadcast(message);
      enqueuePlayerSound(killer, 'mob.wither.death');
   } catch (error) {
      logError('Stats', 'First blood broadcast failed', error);
   }
}

export function resetAnnouncer() {
   multiKill.clear();
   killStreak.clear();
   setFirstBloodDone(false);

   const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
   for (let pi = 0, pLen = players.length; pi < pLen; pi++) {
      const p = players[pi];
      if (!p?.isValid) continue;
      const tag = p.nameTag;
      if (!tag) continue;
      if (tag === p.name) continue;
      if (!tag.includes('\n')) continue;
      p.nameTag = p.name;
   }

   logWarn('UHC', 'Announcer System Reset.');
}

export function trackHit(attacker, victim, cause) {
   if (!victim) return;
   const victimId = victim.id;
   if (!victimId) return;

   const attackerId = attacker?.id;
   const isSelfInflicted = !!attackerId && attackerId === victimId;

   let finalCause = cause;
   if (!finalCause) {
      finalCause = 'unknown';
   }

   const currentTick = system.currentTick;
   const existing = hitRegistry.get(victimId);
   const nextAttackerId = isSelfInflicted ? null : attackerId;

   if (existing?.tick === currentTick && existing.attackerId === nextAttackerId && existing.cause === finalCause && existing.isSelfInflicted === isSelfInflicted) {
      return;
   }

   if (!existing) {
      hitRegistry.set(victimId, {
         attackerId: nextAttackerId,
         cause: finalCause,
         damageType: finalCause,
         tick: currentTick,
         isSelfInflicted,
      });
      return;
   }

   const existingHasRecentPlayerAttacker = !!existing.attackerId && currentTick - existing.tick <= HIT_TIMEOUT_TICKS;

   if (isSelfInflicted) {
      if (!existingHasRecentPlayerAttacker) {
         existing.attackerId = null;
         existing.isSelfInflicted = true;
      }
   } else if (attackerId || !existingHasRecentPlayerAttacker) {
      existing.attackerId = attackerId;
      existing.isSelfInflicted = false;
   } else {
      existing.isSelfInflicted = false;
   }
   existing.cause = finalCause;
   existing.damageType = finalCause;
   existing.tick = currentTick;
}

export function handlerHit() {
   const currentTick = system.currentTick;
   for (const [victimId, entry] of hitRegistry) {
      if (!entry) {
         hitRegistry.delete(victimId);
         continue;
      }
      if (!allPlayersCacheIds.has(victimId)) {
         hitRegistry.delete(victimId);
         continue;
      }
      if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
         hitRegistry.delete(victimId);
      }
   }
}

function getRecentHitEntry(victimId) {
   if (!victimId) return null;
   const entry = hitRegistry.get(victimId);
   if (!entry) return null;

   const currentTick = system.currentTick;
   if (currentTick - entry.tick > HIT_TIMEOUT_TICKS) {
      hitRegistry.delete(victimId);
      return null;
   }

   return entry;
}

function resolveKiller(victimId) {
   const entry = getRecentHitEntry(victimId);
   if (!entry?.attackerId) return null;

   const killer = playerCache.get(entry.attackerId);
   if (!killer) return null;
   if (!killer.isValid) return null;
   return killer;
}

function resolveDeathCause(victimId) {
   const entry = getRecentHitEntry(victimId);
   if (!entry) return 'environment';

   if (entry.isSelfInflicted) return 'self';
   if (!entry.attackerId) return entry.damageType ?? entry.cause ?? 'environment';
   return 'player';
}

function getKillerDisplay(player) {
   const resolvedKiller = resolveKiller(player.id);
   if (!resolvedKiller?.isValid || resolvedKiller.id === player.id) {
      return getEnvironmentDeath(player.id);
   }

   const teamId = playerTeamCache.get(resolvedKiller.id);
   if (!teamId) return resolvedKiller.name;

   const team = TEAM_LOOKUP.get(teamId);
   if (!team) return resolvedKiller.name;

   return `${team.color}${resolvedKiller.name}§r`;
}

function getEnvironmentDeath(playerId) {
   switch (resolveDeathCause(playerId)) {
      case 'fall':
         return 'fall damage';
      case 'lava':
         return 'lava';
      case 'fire':
      case 'fire_tick':
         return 'fire';
      case 'drowning':
         return 'drowning';
      case 'void':
         return 'the void';
      case 'explosion':
         return 'explosion';
      case 'projectile':
         return 'shot';
      case 'entityAttack':
      case 'entity_attack':
         return 'mob attack';
      case 'self':
         return 'self-inflicted damage';
      case 'player':
         return 'player attack';
      case 'environment':
         return 'died';
      default:
         return 'died';
   }
}

function getDeathDisplayInfo(player) {
   const resolvedKiller = resolveKiller(player.id);
   if (resolvedKiller?.isValid && resolvedKiller.id !== player.id) {
      return {
         isPlayerKill: true,
         text: getKillerDisplay(player),
      };
   }

   const cause = resolveDeathCause(player.id);
   return {
      isPlayerKill: false,
      cause,
      text: getEnvironmentDeath(player.id),
   };
}

function showDeathUI(player, deathInfo) {
   try {
      const subtitle = deathInfo?.isPlayerKill ? `§7Killed by ${deathInfo.text}` : `§7Cause: ${deathInfo?.text ?? 'unknown'}`;

      player.onScreenDisplay.setTitle('§cYOU DIED', {
         fadeInDuration: 10,
         stayDuration: 80,
         fadeOutDuration: 100,
         subtitle,
      });
      enqueuePlayerSound(player, 'random.orb', {
         volume: 1,
         pitch: 0.6,
      });
   } catch (error) {
      logError('Stats', 'Failed to show death UI', error);
   }
}

function sendDeathMessage(player, deathInfo) {
   try {
      const stats = playerStats.get(player.id) ?? { kills: 0, deaths: 0 };
      const detailLine = deathInfo?.isPlayerKill ? `§eKilled by §r${deathInfo.text}` : `§eCause: §r${deathInfo?.text ?? 'unknown'}`;

      enqueuePlayerMessage(
         player,
         `\n` +
            `§7==========================\n` +
            `§c            YOU DIED\n` +
            `§7==========================\n\n` +
            `${detailLine}\n\n` +
            `§eSTATS\n` +
            `§7 » Kills: §c${stats.kills}\n` +
            `§7 » Deaths: §c${stats.deaths}\n\n` +
            `§9 » Sleeplite: discord.gg/gtqfbmvTJK\n\n` +
            `§7==========================\n\n`,
      );
   } catch (error) {
      logError('Stats', 'Failed to send death message', error);
   }
}

export { getDeathDisplayInfo, handleFirstBlood, handleKillStreak, handleMultiKill, incrementPairHistory, resolveDeathCause, resolveKiller, sendDeathMessage, showDeathUI };
