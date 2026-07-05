import { ActionFormData } from '@minecraft/server-ui';
import { MENU_MSG, TEAMS } from '../../constants/game.js';
import { refreshPlayerCaches } from '../../features/cache/CacheManager.js';
import { playerCache, playerTeamCache } from '../../features/cache/State_Cache.js';
import { TEAM_LOOKUP } from '../../features/team/State_Team.js';
import { AdminTeleport, getOtherUhcPlayers, playerTeleport, teleportGetAllPlayers } from '../../features/team/TeleportManager.js';
import { logError } from '../../shared/Util.js';

export function showTeleportForm(player, isAdmin) {
   if (!player) return;
   if (!player.isValid) return;

   refreshPlayerCaches();

   const mode = isAdmin ? { isAdmin: true, doTeleport: AdminTeleport } : { isAdmin: false, doTeleport: playerTeleport };

   const others = getOtherUhcPlayers(player.id);
   const form = new ActionFormData();
   form.title(MENU_MSG.teleportTitle);

   const buttonMap = [];

   form.button(MENU_MSG.teleportRandom, 'textures/ui/icon_random');
   buttonMap.push({ type: 'random' });

   form.button(MENU_MSG.teleportAllPlayers, 'textures/ui/multiplayer_glyph_color');
   buttonMap.push({ type: 'all' });

   const teamCountLocal = new Map();

   for (const target of others) {
      const tid = playerTeamCache.get(target.id);
      if (tid) {
         teamCountLocal.set(tid, (teamCountLocal.get(tid) ?? 0) + 1);
      }
   }

   for (const team of TEAMS) {
      const count = teamCountLocal.get(team.id) ?? 0;
      if (count > 0) {
         form.button(team.color + team.name + ' §8(' + count + ')', team.icon);
         buttonMap.push({ type: 'team', teamId: team.id });
      }
   }

   if (mode.isAdmin) {
      form.button(MENU_MSG.back);
      buttonMap.push({ type: 'back' });
   }

   form
      .show(player)
      .then((res) => {
         if (!res) return;
         if (res.canceled) return;
         const action = buttonMap[res.selection];
         if (!action) return;
         switch (action.type) {
            case 'random':
               teleportRandom(player, mode.isAdmin);
               break;
            case 'all':
               teleportShowAllPlayers(player, mode);
               break;
            case 'team':
               teleportShowTeamPlayers(player, action.teamId, mode);
               break;
            case 'back':
               AdminMenu(player);
               break;
         }
      })
      .catch((error) => {
         logError('TeleportMenu', 'showTeleportForm error', error);
      });
}

function teleportRandom(player, isAdmin) {
   const candidates = getOtherUhcPlayers(player.id);

   if (candidates.length === 0) {
      try {
         player.sendMessage(MENU_MSG.noValidUhc);
      } catch (error) {
         logError('TeleportMenu', 'Failed to send no valid UHC message', error);
      }
      return;
   }

   const target = candidates[(Math.random() * candidates.length) | 0];

   if (isAdmin) {
      AdminTeleport(player, target);
   } else {
      playerTeleport(player, target);
   }
}

function teleportShowAllPlayers(player, mode) {
   const others = teleportGetAllPlayers(player);
   const targetIds = [];
   const form = new ActionFormData();
   form.title(MENU_MSG.teleportAllTitle);

   if (others.length === 0) {
      form.body(MENU_MSG.noPlayersAvailable);
      form.button(MENU_MSG.back);
      form
         .show(player)
         .then(() => {
            showTeleportForm(player, mode.isAdmin);
         })
         .catch((error) => {
            logError('TeleportMenu', 'teleportShowAllPlayers form error (empty)', error);
         });
      return;
   }

   for (const p of others) {
      let label = p.name + ' §8| No Team';
      const teamId = playerTeamCache.get(p.id);
      if (teamId) {
         const team = TEAM_LOOKUP.get(teamId);
         if (team) {
            label = team.color + p.name + ' §8| ' + team.name;
         }
      }
      form.button(label, 'textures/ui/multiplayer_glyph_color');
      targetIds.push(p.id);
   }

   form.button(MENU_MSG.back);
   form
      .show(player)
      .then((res) => {
         if (!res) return;
         if (res.canceled) return;
         if (res.selection === targetIds.length) {
            showTeleportForm(player, mode.isAdmin);
            return;
         }
         const target = playerCache.get(targetIds[res.selection]);
         if (!target?.isValid) return;
         mode.doTeleport(player, target);
      })
      .catch((error) => {
         logError('TeleportMenu', 'teleportShowAllPlayers form error', error);
      });
}

function teleportShowTeamPlayers(player, teamId, mode) {
   const team = TEAM_LOOKUP.get(teamId);
   if (!team) return showTeleportForm(player, mode.isAdmin);

   const teamPlayers = getOtherUhcPlayers(player.id).filter((p) => playerTeamCache.get(p.id) === teamId);
   const targetIds = [];
   const form = new ActionFormData();
   form.title(`${team.color}${team.name} Team`);

   if (teamPlayers.length === 0) {
      form.body(MENU_MSG.noPlayersAvailable);
      form.button(MENU_MSG.back);
      return form
         .show(player)
         .then(() => showTeleportForm(player, mode.isAdmin))
         .catch((error) => {
            logError('TeleportMenu', 'teleportShowTeamPlayers form error (empty)', error);
         });
   }

   for (const target of teamPlayers) {
      form.button(`${team.color}${target.name}`, team.icon);
      targetIds.push(target.id);
   }
   form.button(MENU_MSG.back);

   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         if (res.selection === targetIds.length) return showTeleportForm(player, mode.isAdmin);
         const picked = playerCache.get(targetIds[res.selection]);
         if (!picked?.isValid) return;
         mode.doTeleport(player, picked);
      })
      .catch((error) => {
         logError('TeleportMenu', 'teleportShowTeamPlayers form error', error);
      });
}
