import { system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { dynamicToast } from '../plugin/Util.js';
import { clearTeamRuntimeState, refreshPlayerCaches, removePlayerFromRuntimeState } from './CacheManager.js';
import { getBoard, updateSidebar } from './ScoreboardManager.js';
import {
    CONFIG,
    TEAMS,
    TEAM_INDEX_MAP,
    TEAM_LOOKUP,
    aliveTeamDirtyHandler,
    allPlayersCache,
    allPlayersCacheIds,
    clearAllReviveRuntime,
    deathLocation,
    getPlayersByTeamBuf,
    hitRegistry,
    isGameRunning,
    particleLocPool,
    playerCache,
    playerStats,
    playerTeamCache,
    teamCounts,
    teamKillObj,
    teamPlayerIndex,
    teamStats,
    uhcPlayersCache,
} from './State.js';
import { resetAnnouncer, scheduleSaveStats } from './StatsManager.js';

export function getCachedPlayers() {
    return allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
}

export function getPlayerTeam(player) {
    if (!player?.isValid) return null;
    const cachedTeamId = playerTeamCache.get(player.id);
    if (typeof cachedTeamId === 'string' && TEAM_LOOKUP.has(cachedTeamId)) {
        return cachedTeamId;
    }

    const dynamicTeamId = player.getDynamicProperty(CONFIG.key);
    if (typeof dynamicTeamId === 'string' && TEAM_LOOKUP.has(dynamicTeamId)) {
        return dynamicTeamId;
    }

    return null;
}

function syncTag(player, oldTeamId, newTeamId) {
    if (oldTeamId === newTeamId) return;

    if (typeof oldTeamId === 'string' && oldTeamId.length > 0 && player.hasTag(oldTeamId)) {
        player.removeTag(oldTeamId);
    }

    if (typeof newTeamId !== 'string' || newTeamId.length === 0 || !TEAM_LOOKUP.has(newTeamId)) return;

    if (!player.hasTag(newTeamId)) {
        player.addTag(newTeamId);
    }
}

export function setTeam(player, teamId) {
    if (!player?.id) return;
    const oldTeamId = playerTeamCache.get(player.id) ?? null;
    if (oldTeamId === teamId) return;
    const shouldTrack = !isGameRunning || player?.hasTag('uhc');

    if (oldTeamId && shouldTrack) {
        teamPlayerIndex.get(oldTeamId)?.delete(player.id);
    }

    if (teamId) {
        player.setDynamicProperty(CONFIG.key, teamId);
        playerTeamCache.set(player.id, teamId);
        if (shouldTrack) {
            teamPlayerIndex.get(teamId)?.add(player.id);
        }

        const teamIndex = (TEAM_INDEX_MAP.get(teamId) ?? -1) + 1;
        const teamInfo = TEAM_LOOKUP.get(teamId);
        if (teamInfo) {
            player.nameTag = `[${teamIndex}] ${teamInfo.color}${player.name}`;
        }

        const ps = playerStats.get(player.id) ?? { kills: 0, deaths: 0 };
        ps.name = player.name;
        ps.teamId = teamId;
        playerStats.set(player.id, ps);

        scheduleSaveStats();
    } else {
        player.setDynamicProperty(CONFIG.key, null);
        playerTeamCache.delete(player.id);
        player.nameTag = player.name;
    }

    syncTag(player, oldTeamId, teamId ?? null);
    aliveTeamDirtyHandler();
}

export function joinTeam(player, newTeamId) {
    if (!TEAM_LOOKUP.has(newTeamId)) return;

    const oldTeam = getPlayerTeam(player);
    if (oldTeam === newTeamId) return;

    const shouldTrack = !isGameRunning || player?.hasTag('uhc');

    if (shouldTrack && oldTeam) {
        const oldCount = teamCounts.get(oldTeam) ?? 0;
        teamCounts.set(oldTeam, oldCount > 0 ? oldCount - 1 : 0);
    }

    if (shouldTrack) {
        const newCount = teamCounts.get(newTeamId) ?? 0;
        teamCounts.set(newTeamId, newCount + 1);
    }

    setTeam(player, newTeamId);

    if (shouldTrack) {
        if (oldTeam) updateSidebar(oldTeam);
        updateSidebar(newTeamId);
    }
}

export function leaveTeam(player) {
    const oldTeam = getPlayerTeam(player);
    if (!oldTeam) return;
    const shouldTrack = !isGameRunning || player?.hasTag('uhc');
    if (shouldTrack) {
        const current = teamCounts.get(oldTeam) ?? 0;
        teamCounts.set(oldTeam, current > 0 ? current - 1 : 0);
    }
    setTeam(player, null);
    if (shouldTrack) {
        updateSidebar(oldTeam);
    }
}

export function clearAllTeams(executor) {
    if (executor && !executor.hasTag(CONFIG.adminTag)) return;
    refreshPlayerCaches();
    clearAllReviveRuntime();

    const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();
    const teamsLen = TEAMS.length;

    clearTeamRuntimeState();

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player?.isValid) continue;

        const cachedTeam = playerTeamCache.get(player.id);
        if (cachedTeam) player.removeTag(cachedTeam);

        player.setDynamicProperty(CONFIG.key, undefined);
        removePlayerFromRuntimeState(player.id, cachedTeam, false);
        player.nameTag = player.name;
    }

    const board = getBoard();
    for (let i = 0; i < teamsLen; i++) {
        const entry = `${TEAMS[i].color}${TEAMS[i].name}`;
        board.removeParticipant(entry);
    }
}

export function clearAllTaguhcAndDynamicProperty(executor) {
    if (executor && !executor.hasTag(CONFIG.adminTag)) return;

    refreshPlayerCaches();
    clearAllReviveRuntime();

    const players = allPlayersCache.length > 0 ? allPlayersCache : world.getPlayers();

    clearTeamRuntimeState();

    for (let i = 0; i < players.length; i++) {
        const player = players[i];
        if (!player?.isValid) continue;

        const teamId = playerTeamCache.get(player.id);
        if (teamId) player.removeTag(teamId);
        if (player.hasTag('uhc')) player.removeTag('uhc');

        player.setDynamicProperty(CONFIG.key, undefined);
        removePlayerFromRuntimeState(player.id, teamId, true);
    }

    hitRegistry.clear();
    deathLocation.clear();
    allPlayersCache.length = 0;
    uhcPlayersCache.length = 0;
    allPlayersCacheIds.clear();
    playerTeamCache.clear();

    resetAnnouncer();

    for (let i = 0; i < TEAMS.length; i++) {
        teamStats.set(TEAMS[i].id, { kills: 0, deaths: 0 });
    }

    playerStats.clear();
    world.setDynamicProperty('uhc_teamStats', undefined);
    world.setDynamicProperty('uhc_playerStats', undefined);

    if (teamKillObj) {
        for (let i = 0; i < TEAMS.length; i++) {
            const label = `${TEAMS[i].color}${TEAMS[i].name}`;
            teamKillObj.removeParticipant(label);
        }
    }

    const board = getBoard();
    for (let i = 0; i < TEAMS.length; i++) {
        const entry = `${TEAMS[i].color}${TEAMS[i].name}`;
        board.removeParticipant(entry);
    }

    console.warn('[UHC] All tags, dynamic properties, and runtime states cleared.');
}

export function getPlayersByTeam(teamId) {
    if (!TEAM_LOOKUP.has(teamId)) return getPlayersByTeamBuf;

    const ids = teamPlayerIndex.get(teamId);
    if (!ids) return getPlayersByTeamBuf;

    getPlayersByTeamBuf.length = 0;
    for (const id of ids) {
        const player = playerCache.get(id);
        if (player?.isValid) {
            getPlayersByTeamBuf.push(player);
        } else {
            ids.delete(id);
        }
    }

    return getPlayersByTeamBuf;
}

export function openTeamMenu(player) {
    if (isGameRunning && player.hasTag('uhc') && !player.hasTag(CONFIG.adminTag)) {
        player.sendMessage(dynamicToast('§cไม่สามารถเปลี่ยนทีมระหว่างเกมได้', 'textures/ui/cancel'));
        player.playSound('note.bassattack');
        return;
    }
    const form = new ActionFormData();
    form.title(CONFIG.title + 'Team Manager');
    const currentTeamId = getPlayerTeam(player);
    const currentTeam = currentTeamId ? TEAM_LOOKUP.get(currentTeamId) : null;
    let teamDisplay = 'Team?';
    if (currentTeam) {
        teamDisplay = `${currentTeam.color}${currentTeam.name}`;
    }
    form.body(`§f${player.name}: ${teamDisplay}`);
    const teamsLen = TEAMS.length;
    for (let i = 0; i < teamsLen; i++) {
        const team = TEAMS[i];
        form.button(`${team.color}${team.name}`, team.icon);
    }
    form.button('§cLeave', 'textures/ui/permissions_visitor_hand');
    form.button('§6Refresh', 'textures/ui/refresh_light');
    form.button('§7Close', 'textures/ui/cancel');
    form.show(player).then((res) => {
        if (!res || res.canceled) return;
        const selection = res.selection;

        if (selection < teamsLen) {
            const selectedTeam = TEAMS[selection];
            if (currentTeamId === selectedTeam.id) {
                player.playSound('note.bassattack');
                player.sendMessage(dynamicToast('§oAlready', selectedTeam.icon));
                system.run(() => openTeamMenu(player));
                return;
            }
            joinTeam(player, selectedTeam.id);
            try {
                particleLocPool.x = player.location.x;
                particleLocPool.y = player.location.y + 1;
                particleLocPool.z = player.location.z;
                player.dimension.spawnParticle(selectedTeam.id, particleLocPool);
            } catch (e) {
                console.info('[spawnParticle] Ignore Error ');
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
                    player.playSound('note.bassattack');
                    player.sendMessage(dynamicToast('§cYou have no team', 'textures/ui/cancel'));
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
