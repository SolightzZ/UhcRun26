import { ActionFormData } from '@minecraft/server-ui';
import { REVIVE_MSG } from '../../constants/game.js';
import { uhcPlayerIds } from '../../features/cache/State_Cache.js';
import { isGameRunning } from '../../features/match/State_Game.js';
import { notifyReviverCooldown } from '../../features/revive/ReviveCooldown.js';
import { tryStartRevive } from '../../features/revive/ReviveManager.js';
import { getDeadPlayersInTeam, hasReviveItem, resolvePlayer } from '../../features/revive/ReviveUtil.js';
import { deathLocation } from '../../features/team/State_Team.js';
import { getPlayerTeam } from '../../features/team/TeamActions.js';
import { logError, SND_BASS, TEX_CANCEL, TEX_HEART } from '../../shared/Util.js';

function openReviveUI(player, deadList) {
   if (!player?.isValid) return;

   const targetIds = deadList.map((target) => target.id);
   const reviverTeamId = getPlayerTeam(player);

   const form = new ActionFormData();
   form.title(REVIVE_MSG.uiTitle);
   form.body(REVIVE_MSG.uiBody);

   for (let di = 0, dLen = deadList.length; di < dLen; di++) {
      form.button(deadList[di].name, TEX_HEART);
   }

   form.button(REVIVE_MSG.uiBack, TEX_CANCEL);
   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         if (res.selection === targetIds.length) return;

         const targetId = targetIds[res.selection];
         if (!targetId) return;

         const target = resolvePlayer(targetId);
         if (!target) return;
         if (!deathLocation.has(targetId)) return;
         if (getPlayerTeam(target) !== reviverTeamId) return;

         tryStartRevive(player, target);
      })
      .catch((error) => {
         logError('ReviveUI', 'openReviveUI form error', error);
      });
}

export function onUseReviveItem(player) {
   if (!player?.isValid) return;
   if (!isGameRunning) return;
   if (!uhcPlayerIds.has(player.id)) return;
   if (!hasReviveItem(player)) return;

   if (notifyReviverCooldown(player, true)) return;

   const deadList = getDeadPlayersInTeam(player);

   if (deadList.length === 0) {
      player.playSound(SND_BASS);
      return;
   }

   openReviveUI(player, deadList);
}
