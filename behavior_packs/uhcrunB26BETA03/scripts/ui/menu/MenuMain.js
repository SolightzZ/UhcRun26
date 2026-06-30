//เมนูหลักของ UHC (Spawn, Team, Features, Credits, Admin) — server-ui only
import { ActionFormData } from '@minecraft/server-ui';
import { logError } from '../../shared/Util.js';
import { CONFIG, MENU_MSG } from '../../constants/game.js';
import { refreshPlayerCaches } from '../../features/cache/CacheManager.js';
import { openTeamMenu } from '../../ui/team/TeamActionsUI.js';
import { teleportToSpawn } from '../../features/team/TeleportManager.js';
import { AdminMenu } from './MenuAdmin.js';
import { Credits, Features, Ranks } from './MenuInfo.js';

//แสดงเมนูหลักให้ผู้เล่น (มีปุ่ม Admin ถ้ามี tag admin)
export function openMainMenu(player) {
   if (!player?.isValid) return;
   refreshPlayerCaches();

   const form = new ActionFormData();
   form.title(CONFIG.title);
   form.body(MENU_MSG.mainMenuBody);
   form.button('Spawn', 'textures/ui/icons/icon_mashupworld');
   form.button('Team', 'textures/ui/icons/icon_multiplayer');
   form.button('Features', 'textures/ui/creative_icon');
   form.button('Credits', 'textures/ui/icon_book_writable');
   form.button('Ranks', 'textures/ui/village_hero_effect');

   if (player.hasTag(CONFIG.adminTag)) {
      form.button('Admin', 'textures/ui/Add-Ons_Side-Nav_Icon_24x24');
   }

   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         switch (res.selection) {
            case 0:
               teleportToSpawn(player);
               break;
            case 1:
               openTeamMenu(player);
               break;
            case 2:
               Features(player);
               break;
            case 3:
               Credits(player);
               break;
            case 4:
               Ranks(player);
               break;
            case 5:
               if (player.hasTag(CONFIG.adminTag)) AdminMenu(player);
               break;
         }
      })
      .catch((error) => {
         logError('Menu', 'openMainMenu form error', error);
      });
}
