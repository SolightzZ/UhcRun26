import { ActionFormData } from '@minecraft/server-ui';
import { CONFIG, MENU_MSG, TEAMS } from '../../constants/game.js';
import { refreshPlayerCaches } from '../../features/cache/CacheManager.js';
import { playerCache, playerTeamCache, uhcPlayersCache } from '../../features/cache/State_Cache.js';
import { hitRegistry } from '../../features/kill/HitTracker.js';
import { killStreak, multiKill } from '../../features/kill/KillAnnouncer.js';
import { TEAM_LOOKUP, deathLocation, getTeamCount, playerStats, teamPlayerIndex, teamStats } from '../../features/team/State_Team.js';
import { getCachedPlayers, getPlayersByTeam } from '../../features/team/TeamActions.js';
import { logError, logWarn } from '../../shared/Util.js';
import { go, setNav } from '../MenuRouter.js';
import { Managements, clearTeams, killList, playerLists } from './MenuAdminForms.js';

function showDumpViewer(admin, title, body, logTag) {
   const plain = body.replace(/§./g, '');

   const form = new ActionFormData();

   form.title(title);

   form.body(body);
   form.button(MENU_MSG.console, 'textures/ui/icons/icon_fall');

   form.button(MENU_MSG.back);

   form
      .show(admin)
      .then((res) => {
         if (!res || res.canceled) return;

         if (res.selection === 0) {
            logWarn(logTag, '\\n' + plain);
         }

         AdminMenu(admin);
      })
      .catch((error) => {
         logError('AdminMenu', 'showDumpViewer form error', error);
      });
}

function viewDynamicProperty(admin) {
   if (!admin?.isValid) return;
   const players = getCachedPlayers();
   const body = players
      .filter((p) => p?.isValid)
      .map((p) => `§7${p.name} §8= §c${playerTeamCache.get(p.id) ?? 'null'}`)
      .join('\\n');
   showDumpViewer(admin, 'Dynamic Properties', body, 'DYNAMIC PROPERTY DUMP');
}

function viewAllMaps(admin) {
   if (!admin?.isValid) return;
   let body = '';

   const dumpMap = (label, map, formatter) => {
      body += `§e[${label}]§r\\n`;

      if (!map) {
         body += ' §7<null>\\n\\n';
         return;
      }

      const iter = map.entries();
      let count = 0;
      for (const entry of iter) {
         const [k, v] = entry;
         try {
            body += formatter(k, v);
         } catch (error) {
            logError('AdminMenu', 'View All Maps', error);
            body += ' §c<format error>\\n';
         }
         count++;
         if (count > 200) {
            body += ` §7... and ${map.size - count} more entries\\n`;
            break;
         }
      }

      body += '\\n';
   };

   const resolveName = (id) => playerCache.get(id)?.name ?? id;

   dumpMap('teamPlayerIndex', teamPlayerIndex, (k, v) => ` §7${k} §8: §e${v.size}\\n`);
   dumpMap('playerTeamCache', playerTeamCache, (k, v) => ` §7${resolveName(k)} §8: §c${v}\\n`);
   dumpMap('teamStats', teamStats, (k, v) => ` §7${k} §8: §cK:${v.kills} D:${v.deaths}\\n`);
   dumpMap('playerStats', playerStats, (k, v) => ` §7${k} §8: §cK:${v.kills} D:${v.deaths}\\n`);
   dumpMap('deathLocation', deathLocation, (k, v) => ` §7${resolveName(k)} §8: §c${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}\\n`);
   dumpMap('multiKill', multiKill, (k, v) => ` §7${resolveName(k)} §8: §cCount:${v.count} Tick:${v.tick}\\n`);
   dumpMap('killStreak', killStreak, (k, v) => ` §7${resolveName(k)} §8: §cStreak:${v}\\n`);
   dumpMap('hitRegistry', hitRegistry, (k, v) => ` §7Victim:${resolveName(k)} §8<- §cAttacker:${resolveName(v.attackerId)} §8(Tick:${v.tick})\\n`);

   showDumpViewer(admin, 'Map Data Dump', body, 'MAP DUMP');
}

function viewPlayerStatus(admin) {
   if (!admin?.isValid) return;
   const players = getCachedPlayers();
   const body = players
      .filter((p) => p?.isValid)
      .map((p) => {
         const gm = typeof p.getGameMode === 'function' ? p.getGameMode() : 'Unknown';
         const health = p.getComponent('minecraft:health');
         const hp = health?.currentValue !== undefined ? health.currentValue.toFixed(1) : '?';
         return `§e${p.name} §8| GM: §7${gm} §8| HP: §c${hp}`;
      })
      .join('\\n');
   showDumpViewer(admin, 'Player Status Viewer', body, 'PLAYER STATUS DUMP');
}

function viewUhcPlayerList(admin) {
   if (!admin?.isValid) return;
   let body = `Total Online UHC Players: §c${uhcPlayersCache.length}\\n\\n`;
   for (const p of uhcPlayersCache) {
      const team = TEAM_LOOKUP.get(playerTeamCache.get(p.id));
      body += team ? `§7${p.name} §8- ${team.color}${team.name}\\n` : `§7${p.name} §8- §cNo Team\\n`;
   }
   showDumpViewer(admin, 'UHC Player List', body, 'UHC PLAYER LIST DUMP');
}

function viewTeamStats(admin) {
   if (!admin?.isValid) return;
   let body = '';
   for (const team of TEAMS) {
      const stats = teamStats.get(team.id) ?? { kills: 0, deaths: 0 };
      const alive = getTeamCount(team.id);
      const players = getPlayersByTeam(team.id);

      body += `${team.color}${team.name} §8| Alive: §a${alive} §8| Kills: §c${stats.kills} §8| Deaths: §4${stats.deaths}\\n`;
      for (const p of players) {
         body += `${team.color} - ${p.name}\\n`;
      }
      if (players.length) body += '\\n';
   }
   showDumpViewer(admin, 'Team Stats', body, 'TEAM STATS DUMP');
}

function viewDeathLocations(admin) {
   if (!admin?.isValid) return;
   let body = '';
   for (const [id, loc] of deathLocation) {
      const name = playerCache.get(id)?.name ?? id;
      body += `§c${name} §8died at §e${loc.x.toFixed(0)}, ${loc.y.toFixed(0)}, ${loc.z.toFixed(0)}\\n`;
   }
   if (!deathLocation.size) body += '§7No deaths recorded.';
   showDumpViewer(admin, 'Death Locations', body, 'DEATH LOCATIONS DUMP');
}

export function AdminMenu(player) {
   if (!player?.isValid) return;
   refreshPlayerCaches();

   const form = new ActionFormData();
   form.title(CONFIG.title);
   form.body(MENU_MSG.adminBody);
   form.button('Player', 'textures/ui/sidebar_icons/genre');
   form.button('Kill', 'textures/ui/sidebar_icons/character_creator');
   form.button('Clear', 'textures/ui/icon_trash');
   form.button('Teleport', 'textures/ui/sidebar_icons/my_characters');
   form.button('Manager', 'textures/ui/icons/icon_blackfriday');
   form.button('Dynamic Props', 'textures/ui/icon_recipe_item');
   form.button('View Maps', 'textures/ui/magnifyingGlass');
   form.button('Player\\nStatus', 'textures/ui/xbox4');
   form.button('UHC Player List', 'textures/ui/servers');
   form.button('Team Stats', 'textures/ui/icons/icon_spring');
   form.button('Death Locations', 'textures/ui/icon_recipe_equipment');
   form.button('Back', 'textures/ui/wysiwyg_reset');

   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;

         switch (res.selection) {
            case 0:
               playerLists(player);
               break;
            case 1:
               killList(player);
               break;
            case 2:
               clearTeams(player);
               break;
            case 3:
               go(player, 'teleport', true);
               break;
            case 4:
               Managements(player);
               break;
            case 5:
               viewDynamicProperty(player);
               break;
            case 6:
               viewAllMaps(player);
               break;
            case 7:
               viewPlayerStatus(player);
               break;
            case 8:
               viewUhcPlayerList(player);
               break;
            case 9:
               viewTeamStats(player);
               break;
            case 10:
               viewDeathLocations(player);
               break;
            case 11:
               go(player, 'main');
               break;
         }
      })
      .catch((error) => {
         logError('AdminMenu', 'AdminMenu form error', error);
      });
}

setNav('admin', AdminMenu);
