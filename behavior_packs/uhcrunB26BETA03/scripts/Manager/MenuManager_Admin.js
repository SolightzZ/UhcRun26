import { ActionFormData } from '@minecraft/server-ui';
import { refreshPlayerCaches } from './CacheManager.js';
import { showTeleportForm } from './MenuManager_Teleport.js';
import { hitRegistry, killStreak, multiKill, playerCache, playerTeamCache, uhcPlayersCache } from './State_Cache.js';
import { kdHistoryObj } from './State_Game.js';
import { TEAM_INDEX_MAP, TEAM_LOOKUP, deathLocation, playerStats, teamCounts, teamStats } from './State_Team.js';
import { clearAllTeams, getCachedPlayers, getPlayerTeam, getPlayersByTeam, joinTeam, leaveTeam } from './TeamActions.js';
import { CONFIG, MENU_MSG, TEAMS } from './UtilTeamManager.js';

function showDumpViewer(admin, title, body, logTag) {
    const plain = body.replace(/§./g, '');
    const form = new ActionFormData();
    form.title(title);
    form.body(body);
    form.button(MENU_MSG.console, 'textures/ui/icons/icon_fall');
    form.button(MENU_MSG.back);
    form.show(admin).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === 0) {
            console.warn(`[${logTag}]\n` + plain);
        }
        AdminMenu(admin);
    });
}

function viewDynamicProperty(admin) {
    if (!admin?.isValid) return;
    const players = getCachedPlayers();
    let body = '';
    for (const p of players) {
        if (!p?.isValid) continue;
        body += `§7${p.name} §8= §c${p.getDynamicProperty(CONFIG.key) ?? 'null'}\n`;
    }
    showDumpViewer(admin, 'Dynamic Properties', body, 'DYNAMIC PROPERTY DUMP');
}

function viewAllMaps(admin) {
    if (!admin?.isValid) return;
    let body = '';

    const dumpMap = (label, map, formatter) => {
        body += `§e[${label}]§r\n`;

        if (!map) {
            body += ' §7<null>\n\n';
            return;
        }

        const iterable = typeof map.entries === 'function' ? map.entries() : typeof map[Symbol.iterator] === 'function' ? map : null;

        if (!iterable) {
            body += ' §7<not iterable>\n\n';
            return;
        }

        for (const [k, v] of iterable) {
            try {
                body += formatter(k, v);
            } catch (error) {
                console.warn('View All Maps: ' + error);
                body += ' §c<format error>\n';
            }
        }

        body += '\n';
    };

    const resolveName = (id) => playerCache.get(id)?.name ?? id;

    dumpMap('teamCounts', teamCounts, (k, v) => ` §7${k} §8: §c${v}\n`);
    dumpMap('playerTeamCache', playerTeamCache, (k, v) => ` §7${resolveName(k)} §8: §c${v}\n`);
    dumpMap('teamStats', teamStats, (k, v) => ` §7${k} §8: §cK:${v.kills} D:${v.deaths}\n`);
    dumpMap('playerStats', playerStats, (k, v) => ` §7${k} §8: §cK:${v.kills} D:${v.deaths}\n`);
    dumpMap('deathLocation', deathLocation, (k, v) => ` §7${resolveName(k)} §8: §c${v.x.toFixed(0)}, ${v.y.toFixed(0)}, ${v.z.toFixed(0)}\n`);
    dumpMap('multiKill', multiKill, (k, v) => ` §7${resolveName(k)} §8: §cCount:${v.count} Tick:${v.tick}\n`);
    dumpMap('killStreak', killStreak, (k, v) => ` §7${resolveName(k)} §8: §cStreak:${v}\n`);
    dumpMap('hitRegistry', hitRegistry, (k, v) => ` §7Victim:${resolveName(k)} §8<- §cAttacker:${resolveName(v.attackerId)} §8(Tick:${v.tick})\n`);

    showDumpViewer(admin, 'Map Data Dump', body, 'MAP DUMP');
}

function viewPlayerStatus(admin) {
    if (!admin?.isValid) return;
    const players = getCachedPlayers();
    let body = '';

    for (const p of players) {
        if (!p?.isValid) continue;
        let gm = 'Unknown';
        if (typeof p.getGameMode === 'function') {
            gm = p.getGameMode();
        }
        const health = p.getComponent('minecraft:health') || p.getComponent('health');
        const hp = health && health.currentValue ? health.currentValue.toFixed(1) : '?';
        body += `§e${p.name} §8| GM: §7${gm} §8| HP: §c${hp}\n`;
    }
    showDumpViewer(admin, 'Player Status Viewer', body, 'PLAYER STATUS DUMP');
}

function viewUhcPlayerList(admin) {
    if (!admin?.isValid) return;
    let body = `Total Online UHC Players: §c${uhcPlayersCache.length}\n\n`;
    for (const p of uhcPlayersCache) {
        const team = TEAM_LOOKUP.get(playerTeamCache.get(p.id));
        body += team ? `§7${p.name} §8- ${team.color}${team.name}\n` : `§7${p.name} §8- §cNo Team\n`;
    }
    showDumpViewer(admin, 'UHC Player List', body, 'UHC PLAYER LIST DUMP');
}

function viewTeamStats(admin) {
    if (!admin?.isValid) return;
    let body = '';
    for (const team of TEAMS) {
        const stats = teamStats.get(team.id) ?? { kills: 0, deaths: 0 };
        const alive = teamCounts.get(team.id) ?? 0;
        const players = getPlayersByTeam(team.id);

        body += `${team.color}${team.name} §8| Alive: §a${alive} §8| Kills: §c${stats.kills} §8| Deaths: §4${stats.deaths}\n`;
        for (const player of players) {
            body += `${team.color} - ${player.name}\n`;
        }
        if (players.length) body += '\n';
    }
    showDumpViewer(admin, 'Team Stats', body, 'TEAM STATS DUMP');
}

function viewDeathLocations(admin) {
    if (!admin?.isValid) return;
    let body = '';
    for (const [id, loc] of deathLocation) {
        const name = playerCache.get(id)?.name ?? id;
        body += `§c${name} §8died at §e${loc.x.toFixed(0)}, ${loc.y.toFixed(0)}, ${loc.z.toFixed(0)}\n`;
    }
    if (!deathLocation.size) body += '§7No deaths recorded.';
    showDumpViewer(admin, 'Death Locations', body, 'DEATH LOCATIONS DUMP');
}

function Managements(admin) {
    const form = new ActionFormData();
    form.title(MENU_MSG.teamManagement);
    const players = getCachedPlayers();
    const pLen = players.length;
    const playerIds = [];

    if (pLen === 0) {
        form.body(MENU_MSG.noPlayersInManagement);
        form.button(MENU_MSG.back);
        return form.show(admin).then(() => AdminMenu(admin));
    }

    for (const p of players) {
        const teamId = playerTeamCache.get(p.id) || p.getDynamicProperty(CONFIG.key);
        const team = TEAM_LOOKUP.get(teamId);
        const label = team ? `${p.name}\n§8[ ${team.color}${team.name} §8]` : `§f${p.name}\n§8[ §cNo Team §8]`;
        form.button(label, team ? team.icon : 'textures/ui/world_glyph_desaturated');
        playerIds.push(p.id);
    }

    form.button(MENU_MSG.back);

    form.show(admin).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === playerIds.length) {
            AdminMenu(admin);
            return;
        }
        const target = playerCache.get(playerIds[res.selection]);
        if (!target?.isValid) return;
        editPlayerMenu(admin, target);
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
    form.show(admin).then((res) => {
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
    });
}

function clearTeams(player) {
    if (!player?.isValid) return;
    const form = new ActionFormData()
        .title('Confirm §4Clear All Teams')
        .body(MENU_MSG.clearTeamsConfirm)
        .button('§cYes', 'textures/ui/container_weight_bar_full')
        .button('§9No', 'textures/ui/container_weight_bar_fill');
    form.show(player).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection !== 0) return;
        clearAllTeams(player);
    });
}

function playerLists(player) {
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
    const pLen = players.length;
    let count = 0;
    let consoleBody = '';
    for (const p of players) {
        if (!p) continue;
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
    }

    if (count === 0) {
        form.body(MENU_MSG.noPlayersOnline);
        consoleBody = 'No players online.';
    }
    const consoleIndex = count;
    const backIndex = count + 1;
    form.button(MENU_MSG.console, 'textures/ui/icons/icon_fall');
    form.button(MENU_MSG.back);
    form.show(player).then((res) => {
        if (!res) return;
        if (res.canceled) return;
        if (res.selection === consoleIndex) {
            console.warn('[Player List]\n' + consoleBody.trimEnd());
            AdminMenu(player);
            return;
        }
        if (res.selection === backIndex) {
            AdminMenu(player);
            return;
        }
    });
}

function killList(player) {
    if (!player) return;
    if (!player.isValid) return;
    if (!kdHistoryObj) return;

    const participants = kdHistoryObj.getParticipants();
    const totals = new Map();
    let history = '';

    if (!participants) return;
    const pLen = participants.length;

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
        const current = totals.get(killer);
        if (current) {
            totals.set(killer, current + score);
        } else {
            totals.set(killer, score);
        }
    }

    const form = new ActionFormData();
    form.title('Kill Death History');

    if (history === '') {
        form.body('History is empty.');
        form.button('Console');
        form.button('Back', 'textures/ui/arrow_left_white');
        form.show(player).then((res) => {
            if (!res) return;
            if (res.canceled) return;
            if (res.selection === 0) {
                console.warn('[KD] History is empty.');
            }
            AdminMenu(player);
        });
        return;
    }

    let body = '§f=== TOTAL KILLS ===\n';
    const sortedTotals = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    for (const entry of sortedTotals) {
        body += '§7' + entry[0] + ' §8= §c' + entry[1] + '\n';
    }
    body += '\n§f=== HISTORY ===\n';
    body += history.trimEnd();
    form.body(body);
    form.button('Console', 'textures/ui/icons/icon_fall');
    form.button('Back');
    form.show(player).then((res) => {
        if (!res) return;
        if (res.canceled) return;
        if (res.selection === 0) {
            const plain = body.replace(/§./g, '');
            console.warn('[KD] Dump:\n' + plain);
        }
        AdminMenu(player);
    });
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
    form.button('Player\nStatus', 'textures/ui/xbox4');
    form.button('UHC Player List', 'textures/ui/servers');
    form.button('Team Stats', 'textures/ui/icons/icon_spring');
    form.button('Death Locations', 'textures/ui/icon_recipe_equipment');

    form.show(player).then((res) => {
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
                showTeleportForm(player, true);
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
        }
    });
}
