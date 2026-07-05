import { system } from '@minecraft/server';
import { CONFIG, MENU_MSG } from '../constants/game.js';
import { isGameRunning } from '../features/match/State_Game.js';
import { showTeleportForm } from '../ui/menu/MenuTeleport.js';

export function tpa(player) {
   system.run(() => {
      if (!player?.isValid) return;
      if (!isGameRunning) return;
      if (player.hasTag(CONFIG.adminTag)) {
         showTeleportForm(player, true);
         return;
      }
      if (player.hasTag(CONFIG.uhcTag)) {
         player.sendMessage(MENU_MSG.tpaBlockedInUhc);
         return;
      }
      showTeleportForm(player, false);
   });
}
