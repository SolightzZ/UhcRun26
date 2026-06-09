//อรรถประโยชน์สำหรับ revive: เช็คไอเทม, ลบไอเทม, หาผู้เล่นตาย
import { getPlayerInventoryContainer } from '../plugin/Util.js';
import { playerCache, playerTeamCache } from './State_Cache.js';
import { REVIVE_ITEM_ID } from './State_Revive.js';
import { deathLocation, teamPlayerIndex } from './State_Team.js';
import { getPlayerTeam } from './TeamActions.js';

export { getPlayerInventoryContainer };

//ค้นหา player object ตาม id ถ้ายัง valid
export function resolvePlayer(id) {
   const player = playerCache.get(id);
   return player?.isValid ? player : null;
}

//ตรวจสอบว่ามีไอเทมหัวผู้เล่นใน hotbar 9 ช่องแรก
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

//ลบไอเทมหัวผู้เล่น 1 อันจาก hotbar
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

//ส่ง actionbar ข้อความ revive ไปทุกคนในทีม
export function sendReviveTeamActionBar(teamId, message) {
   if (!teamId || !message) return;

   const seen = new Set();
   const memberIds = teamPlayerIndex.get(teamId);
   if (memberIds) {
      const memberArr = Array.from(memberIds);
      for (let mi = 0, mLen = memberArr.length; mi < mLen; mi++) {
         const id = memberArr[mi];
         if (seen.has(id)) continue;
         seen.add(id);
         const player = resolvePlayer(id);
         if (!player) continue;
         try {
            player.onScreenDisplay.setActionBar(message);
         } catch (error) {
            console.error('[ReviveUtil] Failed to send actionbar to team member:', error);
         }
      }
   }

   const dlArr = Array.from(deathLocation.entries());
   for (let di = 0, dLen = dlArr.length; di < dLen; di++) {
      const [id] = dlArr[di];
      if (seen.has(id)) continue;
      if (playerTeamCache.get(id) !== teamId) continue;
      const player = resolvePlayer(id);
      if (!player) continue;
      seen.add(id);
      try {
         player.onScreenDisplay.setActionBar(message);
      } catch (error) {
         console.error('[ReviveUtil] Failed to send actionbar to dead player:', error);
      }
   }
}

//หาผู้เล่นที่ตายแล้วในทีมเดียวกัน (จาก deathLocation)
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
