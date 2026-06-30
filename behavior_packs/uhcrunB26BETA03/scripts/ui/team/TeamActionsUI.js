//UI จัดการทีม — แสดง ActionFormData สำหรับเลือกทีม (server-ui only)
import { system } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { CONFIG, TEAM_MENU, TEAMS } from '../../constants/game.js';
import { createLoc, dynamicToast, freeLoc, logError, SND_BASS, TEX_CANCEL } from '../../shared/Util.js';
import { isGameRunning } from '../../features/match/State_Game.js';
import { TEAM_LOOKUP } from '../../features/team/State_Team.js';
import { getPlayerTeam, getTeamPlayerCount, getTotalTeamPlayers, joinTeam, leaveTeam } from '../../features/team/TeamActions.js';

//แสดง GUI เลือกทีม
export function openTeamMenu(player) {
   if (isGameRunning && player.hasTag('uhc') && !player.hasTag(CONFIG.adminTag)) {
      player.sendMessage(dynamicToast(TEAM_MENU.cannotChangeMidGame, TEX_CANCEL));
      player.playSound(SND_BASS);
      return;
   }
   const form = new ActionFormData();
   form.title(CONFIG.title + TEAM_MENU.titleSuffix);
   const currentTeamId = getPlayerTeam(player);
   const currentTeam = currentTeamId ? TEAM_LOOKUP.get(currentTeamId) : null;
   let teamDisplay = TEAM_MENU.unknownTeam;
   if (currentTeam) {
      teamDisplay = `${currentTeam.color}${currentTeam.name}`;
   }
   const totalNow = getTotalTeamPlayers();
   form.body(`§f${player.name}: ${teamDisplay}\\n§7Total: §f${totalNow}§7/§f${CONFIG.maxTotalPlayers}`);
   const teamsLen = TEAMS.length;
   for (let ti = 0; ti < teamsLen; ti++) {
      const team = TEAMS[ti];
      const count = getTeamPlayerCount(team.id);
      form.button(`${team.color}${team.name} §7(${count})`, team.icon);
   }
   form.button(TEAM_MENU.leave, 'textures/ui/permissions_visitor_hand');
   form.button(TEAM_MENU.refresh, 'textures/ui/refresh_light');
   form.button(TEAM_MENU.close, TEX_CANCEL);
   form.show(player).then((res) => {
      if (!res || res.canceled) return;
      const selection = res.selection;

      if (selection < teamsLen) {
         const selectedTeam = TEAMS[selection];
         if (currentTeamId === selectedTeam.id) {
            player.playSound(SND_BASS);
            player.sendMessage(dynamicToast(TEAM_MENU.alreadyOnTeam, selectedTeam.icon));
            system.run(() => openTeamMenu(player));
            return;
         }
         if (!currentTeamId && getTotalTeamPlayers() >= CONFIG.maxTotalPlayers) {
            player.playSound(SND_BASS);
            player.sendMessage(dynamicToast(TEAM_MENU.serverFullShort(CONFIG.maxTotalPlayers), TEX_CANCEL));
            system.run(() => openTeamMenu(player));
            return;
         }
         joinTeam(player, selectedTeam.id);
         try {
            const pLoc = createLoc(player.location.x, player.location.y + 1, player.location.z);
            player.dimension.spawnParticle(selectedTeam.id, pLoc);
            freeLoc(pLoc);
         } catch (error) {
            logError('TeamActions', 'Failed to spawn team particle', error);
         }
         player.playSound('random.orb', { pitch: 0.6, volume: 0.4 });
         player.sendMessage(dynamicToast(`Joined ${selectedTeam.color}${selectedTeam.name}`, selectedTeam.icon));
         system.run(() => openTeamMenu(player));
         return;
      }

      const actionIndex = selection - teamsLen;
      switch (actionIndex) {
         case 0: {
            if (!currentTeamId || !currentTeam) {
               player.playSound(SND_BASS);
               player.sendMessage(dynamicToast(TEAM_MENU.noTeam, TEX_CANCEL));
               system.run(() => openTeamMenu(player));
               return;
            }
            leaveTeam(player);
            player.playSound('random.break');
            player.sendMessage(dynamicToast(`§c§oLeft from ${currentTeam.color}${currentTeam.name}`, 'textures/ui/permissions_visitor_hand'));
            system.run(() => openTeamMenu(player));
            return;
         }
         case 1:
            system.run(() => openTeamMenu(player));
            return;
         case 2:
            return;
      }
   });
}
