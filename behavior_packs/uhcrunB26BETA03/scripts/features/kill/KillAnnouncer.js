import { system } from '@minecraft/server';
import { enqueueBroadcast, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { dynamicToast, logError, logWarn } from '../../shared/Util.js';
import { allPlayersCache } from '../cache/State_Cache.js';
import { MULTI_TIMEOUT_TICKS, firstBloodDone, kdHistoryObj, setFirstBloodDone } from '../match/State_Game.js';

export const multiKill = new Map();
export const killStreak = new Map();

const MULTI_KILL_DATA = Object.freeze([
   null,
   { text: '§eKILL', sound: 'kill1' },
   { text: '§6DOUBLE KILL', sound: 'kill2' },
   { text: '§cTRIPLE KILL', sound: 'kill3' },
   { text: '§5QUADRA KILL', sound: 'kill4' },
   { text: '§4ACE', sound: 'kill5' },
]);

export function incrementPairHistory(killer, victim) {
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

export function handleMultiKill(killer) {
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
      enqueuePlayerSound(allPlayersCache, info.sound, { volume: 0.8 });
   } catch (error) {
      logError('Stats', 'Multi kill broadcast failed', error);
   }
}

export function handleKillStreak(killer) {
   if (!killer) return;
   if (!killer.isValid) return;
   let current = killStreak.get(killer.id);
   if (current === undefined) {
      current = 0;
   }
   current = current + 1;
   killStreak.set(killer.id, current);
}

export function handleFirstBlood(killer, victim) {
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
      enqueuePlayerSound(allPlayersCache, 'firstblood', { volume: 0.8 });
   } catch (error) {
      logError('Stats', 'First blood broadcast failed', error);
   }
}

export function resetAnnouncer() {
   multiKill.clear();
   killStreak.clear();
   setFirstBloodDone(false);

   const players = allPlayersCache;
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
