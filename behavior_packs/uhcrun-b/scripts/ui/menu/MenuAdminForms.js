import { ActionFormData } from '@minecraft/server-ui';
import { CONFIG, MENU_MSG, TEAMS } from '../../constants/game.js';
import { playerCache, playerTeamCache } from '../../features/cache/State_Cache.js';
import { kdHistoryObj } from '../../features/match/State_Game.js';
import { TEAM_INDEX_MAP, TEAM_LOOKUP } from '../../features/team/State_Team.js';
import { clearAllTeams, getCachedPlayers, getPlayerTeam, joinTeam, leaveTeam } from '../../features/team/TeamActions.js';
import { logError, logWarn } from '../../shared/Util.js';
import { go } from '../MenuRouter.js';

export function Managements(admin) {
   const form = new ActionFormData();
   form.title(MENU_MSG.teamManagement);
   const players = getCachedPlayers();
   const pLen = players.length;
   const playerIds = [];

   if (pLen === 0) {
      form.body(MENU_MSG.noPlayersInManagement);
      form.button(MENU_MSG.back);
      return form
         .show(admin)
         .then(() => go(admin, 'admin'))
         .catch((error) => {
            logError('AdminMenu', 'Managements form error (empty)', error);
         });
   }

   players.forEach((p) => {
      const teamId = playerTeamCache.get(p.id) || p.getDynamicProperty(CONFIG.key);
      const team = TEAM_LOOKUP.get(teamId);
      const label = team ? `${p.name}\n§8[ ${team.color}${team.name} §8]` : `§f${p.name}\n§8[ §cNo Team §8]`;
      form.button(label, team ? team.icon : 'textures/ui/world_glyph_desaturated');
      playerIds.push(p.id);
   });

   form.button(MENU_MSG.back);

   form
      .show(admin)
      .then((res) => {
         if (!res || res.canceled) return;
         if (res.selection === playerIds.length) {
            go(admin, 'admin');
            return;
         }
         const target = playerCache.get(playerIds[res.selection]);
         if (!target?.isValid) return;
         editPlayerMenu(admin, target);
      })
      .catch((error) => {
         logError('AdminMenu', 'Managements form error', error);
      });
}

function editPlayerMenu(admin, target) {
   if (!target?.isValid) return Managements(admin);
   const currentTeamId = playerTeamCache.get(target.id) || target.getDynamicProperty(CONFIG.key);
   const form = new ActionFormData();
   form.title(`Manage Team: ${target.name}`);
   const currentTeam = currentTeamId ? TEAM_LOOKUP.get(currentTeamId) : null;
   form.body(`Select a team for ${target.name}.\n§7Current: ${currentTeam ? currentTeam.color + currentTeam.name : '§cUnassigned'}`);
   form.button('Remove from Team', 'textures/ui/permissions_visitor_hand');

   for (const team of TEAMS) {
      const isCurrent = team.id === currentTeamId ? ' §a(Selected)' : '';
      form.button(`${team.color}${team.name}${isCurrent}`, team.icon);
   }

   form.button('Back');
   form
      .show(admin)
      .then((res) => {
         if (!res || res.canceled) return;

         if (res.selection === 0) {
            leaveTeam(target);
            admin.sendMessage(`[x] §f${target.name} §chas been removed from their team.`);
            return Managements(admin);
         }

         if (res.selection <= TEAMS.length) {
            const selectedTeam = TEAMS[res.selection - 1];
            joinTeam(target, selectedTeam.id);
            admin.sendMessage(`[/] §aMoved §f${target.name} §ato ${selectedTeam.color}${selectedTeam.name}§a.`);
            return Managements(admin);
         }

         Managements(admin);
      })
      .catch((error) => {
         logError('AdminMenu', 'editPlayerMenu form error', error);
      });
}

export function clearTeams(player) {
   if (!player?.isValid) return;
   const form = new ActionFormData()
      .title('Confirm §4Clear All Teams')
      .body(MENU_MSG.clearTeamsConfirm)
      .button('§cYes', 'textures/ui/container_weight_bar_full')
      .button('§9No', 'textures/ui/container_weight_bar_fill');
   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         if (res.selection !== 0) return;
         clearAllTeams(player);
      })
      .catch((error) => {
         logError('AdminMenu', 'clearTeams form error', error);
      });
}

export function playerLists(player) {
   if (!player) return;
   if (!player.isValid) return;
   const form = new ActionFormData();
   form.title(MENU_MSG.playerListTitle);
   const players = getCachedPlayers()
      .filter((p) => p?.isValid)
      .slice()
      .sort((a, b) => {
         const teamA = getPlayerTeam(a);
         const teamB = getPlayerTeam(b);
         const indexA = typeof teamA === 'string' ? (TEAM_INDEX_MAP.get(teamA) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
         const indexB = typeof teamB === 'string' ? (TEAM_INDEX_MAP.get(teamB) ?? Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER;
         if (indexA !== indexB) return indexA - indexB;
         return a.name.localeCompare(b.name);
      });
   let count = 0;
   let consoleBody = '';
   players.forEach((p) => {
      if (!p) return;
      const teamId = getPlayerTeam(p);
      let label = p.name + ' | No Team';
      let icon = 'textures/ui/world_glyph_desaturated';
      if (teamId) {
         const team = TEAM_LOOKUP.get(teamId);
         if (team) {
            label = p.name + ' §8| ' + team.color + team.name + '§r';
            icon = team.icon;
         }
      }
      consoleBody += `${count + 1}. ${p.name} | ${teamId ?? 'No Team'}\n`;
      form.button(label, icon);
      count++;
   });

   if (count === 0) {
      form.body(MENU_MSG.noPlayersOnline);
      consoleBody = 'No players online.';
   }
   const consoleIndex = count;
   const backIndex = count + 1;
   form.button(MENU_MSG.console, 'textures/ui/icons/icon_fall');
   form.button(MENU_MSG.back);
   form
      .show(player)
      .then((res) => {
         if (!res) return;
         if (res.canceled) return;
         if (res.selection === consoleIndex) {
            logWarn('AdminMenu', 'Player List\n' + consoleBody.trimEnd());
            go(player, 'admin');
            return;
         }
         if (res.selection === backIndex) {
            go(player, 'admin');
            return;
         }
      })
      .catch((error) => {
         logError('AdminMenu', 'playerLists form error', error);
      });
}

export function killList(player) {
   if (!player) return;
   if (!player.isValid) return;
   if (!kdHistoryObj) return;

   const participants = kdHistoryObj.getParticipants();
   const totals = new Map();
   let history = '';

   if (!participants) return;

   for (const p of participants) {
      if (!p) continue;
      const score = kdHistoryObj.getScore(p);
      if (!score) continue;
      const key = p.displayName;
      if (!key) continue;
      const parts = key.split(' | Victim : ');
      if (parts.length !== 2) continue;
      const killer = parts[0].replace('Kill: ', '');
      if (!killer) continue;
      history += '§7' + key + ' §8= §c' + score + '\n';
      totals.set(killer, (totals.get(killer) ?? 0) + score);
   }

   const form = new ActionFormData();
   form.title('Kill Death History');

   if (history === '') {
      form.body('History is empty.');
      form.button('Console');
      form.button('Back', 'textures/ui/arrow_left_white');
      form
         .show(player)
         .then((res) => {
            if (!res) return;
            if (res.canceled) return;
            if (res.selection === 0) {
               logWarn('AdminMenu', 'KD History is empty.');
            }
            go(player, 'admin');
         })
         .catch((error) => {
            logError('AdminMenu', 'killList form error (empty history)', error);
         });
      return;
   }

   let body = '§f=== TOTAL KILLS ===\n';
   const sortedTotals = [...totals.entries()].sort((a, b) => b[1] - a[1]);
   for (const [killer, score] of sortedTotals) {
      body += `§7${killer} §8= §c${score}\n`;
   }
   body += '\n§f=== HISTORY ===\n';
   body += history.trimEnd();
   form.body(body);
   form.button('Console', 'textures/ui/icons/icon_fall');
   form.button('Back');
   form
      .show(player)
      .then((res) => {
         if (!res) return;
         if (res.canceled) return;
         if (res.selection === 0) {
            const plain = body.replace(/§./g, '');
            logWarn('AdminMenu', 'KD Dump:\n' + plain);
         }
         go(player, 'admin');
      })
      .catch((error) => {
         logError('AdminMenu', 'killList form error', error);
      });
}
