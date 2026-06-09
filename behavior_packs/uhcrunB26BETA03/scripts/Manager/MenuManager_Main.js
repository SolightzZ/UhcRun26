//เมนูหลักของ UHC (Spawn, Team, Features, Credits, Admin)
import { ActionFormData } from '@minecraft/server-ui';
import { refreshPlayerCaches } from './CacheManager.js';
import { AdminMenu } from './MenuManager_Admin.js';
import { Credits, Features, Ranks } from './MenuManager_Info.js';
import { openTeamMenu } from './TeamActions.js';
import { teleportToSpawn } from './TeleportManager.js';
import { CONFIG, MENU_MSG } from './UtilTeamManager.js';

export { teleportToSpawn };

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

   form.show(player).then((res) => {
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
   }).catch((error) => {
      console.error('[Menu] openMainMenu form error:', error);
   });
}
