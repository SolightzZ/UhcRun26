import { enqueuePlayerActionBar } from '../../shared/MessageBatcher.js';
import { logError } from '../../shared/Util.js';
import { getPlayerInventoryContainer } from '../cache/CacheManager.js';
import { playerCache, playerTeamCache } from '../cache/State_Cache.js';
import { deathLocation, teamPlayerIndex } from '../team/State_Team.js';
import { getPlayerTeam } from '../team/TeamActions.js';
import { REVIVE_ITEM_ID } from './State_Revive.js';

export function resolvePlayer(id) {
   const player = playerCache.get(id);
   return player?.isValid ? player : null;
}

export function hasReviveItem(player) {
   const container = getPlayerInventoryContainer(player);
   if (!container) return false;

   const maxSlot = Math.min(9, container.size);
   for (let slot = 0; slot < maxSlot; slot++) {
      const item = container.getItem(slot);
      if (!item) continue;
      if (item.typeId !== REVIVE_ITEM_ID) continue;
      if ((item.amount ?? 0) <= 0) continue;
      return true;
   }

   return false;
}

export function removeOneReviveItem(player) {
   const container = getPlayerInventoryContainer(player);
   if (!container) return false;

   const maxSlot = Math.min(9, container.size);
   for (let slot = 0; slot < maxSlot; slot++) {
      const item = container.getItem(slot);
      if (!item) continue;
      if (item.typeId !== REVIVE_ITEM_ID) continue;

      const amount = item.amount ?? 0;
      if (amount <= 0) continue;

      if (amount === 1) {
         container.setItem(slot, undefined);
      } else {
         item.amount = amount - 1;
         container.setItem(slot, item);
      }
      return true;
   }

   return false;
}

export function sendReviveTeamActionBar(teamId, message) {
   if (!teamId || !message) return;

   const targets = [];
   const seen = new Set();

   const memberIds = teamPlayerIndex.get(teamId);
   if (memberIds) {
      const memberArr = Array.from(memberIds);
      for (let mi = 0, mLen = memberArr.length; mi < mLen; mi++) {
         const id = memberArr[mi];
         if (seen.has(id)) continue;
         seen.add(id);
         const player = resolvePlayer(id);
         if (player) targets.push(player);
      }
   }

   const dlArr = Array.from(deathLocation.entries());
   for (let di = 0, dLen = dlArr.length; di < dLen; di++) {
      const [id] = dlArr[di];
      if (seen.has(id)) continue;
      if (playerTeamCache.get(id) !== teamId) continue;
      const player = resolvePlayer(id);
      if (player) targets.push(player);
   }

   if (targets.length === 0) return;
   enqueuePlayerActionBar(targets, message);
}

export function getDeadPlayersInTeam(player) {
   const deadPlayers = [];
   if (!player?.isValid) return deadPlayers;

   const teamId = getPlayerTeam(player);
   if (!teamId) return deadPlayers;

   const dlArr = Array.from(deathLocation.entries());
   for (let di = 0, dLen = dlArr.length; di < dLen; di++) {
      const [id] = dlArr[di];
      if (id === player.id) continue;
      if (playerTeamCache.get(id) !== teamId) continue;
      const target = resolvePlayer(id);
      if (!target) continue;
      deadPlayers.push(target);
   }

   deadPlayers.sort((a, b) => a.name.localeCompare(b.name));
   return deadPlayers;
}
