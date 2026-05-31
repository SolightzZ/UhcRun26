import { ActionFormData } from '@minecraft/server-ui';
import { notifyReviverCooldown } from './ReviveManager_Cooldown.js';
import { tryStartRevive } from './ReviveManager_Core.js';
import { getDeadPlayersInTeam, hasReviveItem, resolvePlayer } from './ReviveManager_Util.js';
import { isGameRunning } from './State_Game.js';
import { deathLocation } from './State_Team.js';
import { getPlayerTeam } from './TeamActions.js';
import { REVIVE_MSG } from './UtilTeamManager.js';

export function openReviveUI(player, deadList) {
    if (!player?.isValid) return;

    const targetIds = deadList.map((target) => target.id);
    const reviverTeamId = getPlayerTeam(player);

    const form = new ActionFormData();
    form.title(REVIVE_MSG.uiTitle);
    form.body(REVIVE_MSG.uiBody);

    for (const target of deadList) {
        form.button(target.name, 'textures/ui/heart_new');
    }

    form.button(REVIVE_MSG.uiBack, 'textures/ui/cancel');
    form.show(player).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === targetIds.length) return;

        const targetId = targetIds[res.selection];
        if (!targetId) return;

        const target = resolvePlayer(targetId);
        if (!target) return;
        if (!deathLocation.has(targetId)) return;
        if (getPlayerTeam(target) !== reviverTeamId) return;

        tryStartRevive(player, target);
    });
}

export function onUseReviveItem(player) {
    if (!player?.isValid) return;
    if (!isGameRunning) return;
    if (!player.hasTag('uhc')) return;
    if (!hasReviveItem(player)) return;

    if (notifyReviverCooldown(player, true)) return;

    const deadList = getDeadPlayersInTeam(player);

    if (deadList.length === 0) {
        player.playSound('note.bassattack');
        return;
    }

    openReviveUI(player, deadList);
}
