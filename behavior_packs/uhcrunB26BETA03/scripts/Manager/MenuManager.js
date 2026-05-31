import { system, world } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';
import { refreshPlayerCaches } from './CacheManager.js';
import {
    CONFIG,
    TEAMS,
    TEAM_INDEX_MAP,
    TEAM_LOOKUP,
    deathLocation,
    hitRegistry,
    isGameRunning,
    kdHistoryObj,
    killStreak,
    multiKill,
    playerCache,
    playerStats,
    playerTeamCache,
    teamCounts,
    teamStats,
    uhcPlayersCache,
} from './State.js';
import { clearAllTeams, getCachedPlayers, getPlayerTeam, getPlayersByTeam, joinTeam, leaveTeam, openTeamMenu } from './TeamActions.js';
import { AdminTeleport, getOtherUhcPlayers, playerTeleport, teleportGetAllPlayers } from './TeleportManager.js';

function showDumpViewer(admin, title, body, logTag) {
    const plain = body.replace(/§./g, '');
    const form = new ActionFormData();
    form.title(title);
    form.body(body);
    form.button('Console', 'textures/ui/icons/icon_fall');
    form.button('Back');
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
    refreshPlayerCaches();
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
    refreshPlayerCaches();
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
    refreshPlayerCaches();
    let body = `Total Online UHC Players: §c${uhcPlayersCache.length}\n\n`;
    for (const p of uhcPlayersCache) {
        const team = TEAM_LOOKUP.get(playerTeamCache.get(p.id));
        body += team ? `§7${p.name} §8- ${team.color}${team.name}\n` : `§7${p.name} §8- §cNo Team\n`;
    }
    showDumpViewer(admin, 'UHC Player List', body, 'UHC PLAYER LIST DUMP');
}

function viewTeamStats(admin) {
    if (!admin?.isValid) return;
    refreshPlayerCaches();
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

function Credits(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Credits');
    form.header('§eVersion');
    form.label('§7UHCRUNB26BETA04');
    form.divider();
    form.header('§eDeveloper');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eGame Design');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eEngineering');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eSound Design');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eAbout');
    form.label('§7• กระโดดเข้าสู่สนามเอาชีวิตรอด\n§7• รวมทีม วางแผน และต่อสู้\n§7• เอาชีวิตรอดให้ได้นานที่สุด\n§7• จนเหลือทีมสุดท้ายที่ยืนหยัด');
    form.header('§ePowered By');
    form.label('§7Minecraft Bedrock Script API');
    form.header('§eCredits');
    form.label('§7World Border: §fmyGenGaming\n§7Particles: §fRexoes\n§7Lobby Build: §fOMEGA BLADE\n§7Action Form: §fPablo');
    form.divider();
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Credits form failed:', err);
        });
}

function Features(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Features');
    form.header('§eSurvival');
    form.label('§7• Max Health: §f24 HP\n§7• No natural regeneration\n§7• Heal via §fGolden Apple §7& §fCooked Beef\n§7• Grave system (§f48 slots§7)');
    form.divider();
    form.header('§eOre');
    form.label(
        '§7• Iron (→ Iron Ingot + XP)\n§7• Gold (→ Gold Ingot + XP)\n§7• Coal (→ XP)\n§7• Copper (→ XP)\n§7• Emerald (→ XP)\n§7• Lapis (→ Lapis / Book)\n§7• Gravel (→ Arrow)\n§7• Redstone (→ Heal + XP)\n§7• Diamond (→ Sound)\n§7• Obsidian (→ Sound)\n',
    );
    form.divider();
    form.header('§eCombat & PvP');
    form.label(
        '§7• PvP enabled after §f720 ticks (§712 minute§7)\n§7• Knockback system\n§7• Fishing rod mechanics\n§7• Bow hit sound + target name\n§7• CPS Limit: §f20 max\n§7• Kill & Death tracking',
    );
    form.divider();
    form.header('§eWorld Border');
    form.label('§7• Shrinks from §f500x500 → 2x2\n§7• Damage outside border\n§7• Optimized Overworld generation\n§7• Void Nether & End');
    form.divider();
    form.header('§eResources');
    form.label(
        '§7• Auto Smelt (§fOre → Ingot + XP§7)\n§7• Auto Enchant tools\n§7• Food regeneration system\n§7• Tree Capitator + Apple drops\n§7• Auto TNT\n§7• Custom loot tables\n§7• Villager trading',
    );
    form.divider();
    form.header('§eTeam & Revive');
    form.label('§7• สูงสุด §f54 §7คน (9 ทีม)\n§7• Revive using player head (§f30s§7)\n§7• Team chat & colored nametags');
    form.divider();
    form.header('§eUtilities');
    form.label('§7• Scoreboard\n§7• Interaction guard');
    form.divider();
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Features form failed:', err);
        });
}

function Ranks(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Features');
    form.header('Comming Soon');
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Features form failed:', err);
        });
}

function Managements(admin) {
    refreshPlayerCaches();
    const form = new ActionFormData();
    form.title('Team Management');
    const players = getCachedPlayers();
    const pLen = players.length;

    if (pLen === 0) {
        form.body('No players are currently online.');
        form.button('Back');
        return form.show(admin).then(() => AdminMenu(admin));
    }

    for (const p of players) {
        const teamId = playerTeamCache.get(p.id) || p.getDynamicProperty(CONFIG.key);
        const team = TEAM_LOOKUP.get(teamId);
        const label = team ? `${p.name}\n§8[ ${team.color}${team.name} §8]` : `§f${p.name}\n§8[ §cNo Team §8]`;
        form.button(label, team ? team.icon : 'textures/ui/world_glyph_desaturated');
    }

    form.button('Back');

    form.show(admin).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === players.length) {
            AdminMenu(admin);
            return;
        }
        const target = players[res.selection];
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
        .body("จะลบผู้เล่นทุกคนออกจากทุกทีม 'คุณแน่ใจหรือไม่?'")
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
    refreshPlayerCaches();
    const form = new ActionFormData();
    form.title('Player List');
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
        form.body('No players online.');
        consoleBody = 'No players online.';
    }
    const consoleIndex = count;
    const backIndex = count + 1;
    form.button('Console', 'textures/ui/icons/icon_fall');
    form.button('Back');
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
    const form = new ActionFormData();
    form.title(CONFIG.title);
    form.body('Admin');
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

export function showTeleportForm(player, isAdmin) {
    if (!player) return;
    if (!player.isValid) return;

    refreshPlayerCaches();

    const mode = isAdmin ? { isAdmin: true, doTeleport: AdminTeleport } : { isAdmin: false, doTeleport: playerTeleport };

    const others = getOtherUhcPlayers(player.id);
    const form = new ActionFormData();
    form.title('Teleport Menu');

    const buttonMap = [];

    form.button('Random Teleport', 'textures/ui/icon_random');
    buttonMap.push({ type: 'random' });

    form.button('All Players', 'textures/ui/multiplayer_glyph_color');
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
        form.button('Back');
        buttonMap.push({ type: 'back' });
    }

    form.show(player).then((res) => {
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
    });
}

function teleportRandom(player, isAdmin) {
    const candidates = getOtherUhcPlayers(player.id);

    if (candidates.length === 0) {
        player.sendMessage('§c[x] No valid UHC players.');
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
    refreshPlayerCaches();

    const others = teleportGetAllPlayers(player);
    const form = new ActionFormData();
    form.title('All Players');

    if (others.length === 0) {
        form.body('No available players.');
        form.button('Back');
        form.show(player).then(() => {
            showTeleportForm(player, mode);
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
    }

    form.button('Back');
    form.show(player).then((res) => {
        if (!res) return;
        if (res.canceled) return;
        if (res.selection === others.length) {
            showTeleportForm(player, mode);
            return;
        }
        const target = others[res.selection];
        if (!target) return;
        if (!target.isValid) return;
        mode.doTeleport(player, target);
    });
}

function teleportShowTeamPlayers(player, teamId, mode) {
    refreshPlayerCaches();
    const team = TEAM_LOOKUP.get(teamId);
    if (!team) return showTeleportForm(player, mode);

    const teamPlayers = getOtherUhcPlayers(player.id).filter((p) => playerTeamCache.get(p.id) === teamId);
    const form = new ActionFormData();
    form.title(`${team.color}${team.name} Team`);

    if (teamPlayers.length === 0) {
        form.body('No available players.');
        form.button('Back');
        return form.show(player).then(() => showTeleportForm(player, mode));
    }

    for (const target of teamPlayers) {
        form.button(`${team.color}${target.name}`, team.icon);
    }
    form.button('Back');

    form.show(player).then((res) => {
        if (!res || res.canceled) return;
        if (res.selection === teamPlayers.length) return showTeleportForm(player, mode);
        const target = teamPlayers[res.selection];
        if (!target?.isValid) return;
        mode.doTeleport(player, target);
    });
}

export function tpa(player) {
    if (!player) return;
    if (!player.isValid) return;
    if (!isGameRunning) return;
    if (player.hasTag(CONFIG.adminTag)) {
        showTeleportForm(player, true);
        return;
    }
    if (player.hasTag(CONFIG.uhcTag)) {
        player.sendMessage('§c[x] คุณไม่สามารถใช้ TPA ได้ในขณะที่ยังเล่น UHCRUN!');
        return;
    }

    showTeleportForm(player, false);
}

export function teleportToSpawn(player) {
    if (!player?.isValid) return;
    const dim = world.getDimension('overworld');
    const baseX = 596;
    const baseY = 123;
    const baseZ = 609;
    const spawn = {
        x: baseX + Math.floor(Math.random() * 5) - 2,
        y: baseY,
        z: baseZ + Math.floor(Math.random() * 5) - 2,
    };
    player.teleport(spawn, { dimension: dim });
    const tx = spawn.x;
    const ty = spawn.y;
    const tz = spawn.z;
    system.runTimeout(() => {
        if (!player?.isValid) return;
        player.playSound('random.enderchestopen', { volume: 0.9, pitch: 0.95 });
        try {
            dim.spawnParticle('so:light2', {
                x: tx,
                y: ty + 5,
                z: tz,
            });
        } catch {}
    }, 5);
}

export function openMainMenu(player) {
    const form = new ActionFormData();
    form.title(CONFIG.title);
    form.body('§6UHCRUN26 §7(Mini Game Battle Royal)');
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
    });
}
