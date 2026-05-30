import { system, world } from '@minecraft/server';
import { getPlayerTeam } from '../Manager/TeamManager.js';
import { center, ctx, MinecraftColor } from './BorderManager.js';

const TELEPORT_CONFIG = Object.freeze({
    PRELOAD_Y: 200,
    PRELOAD_DELAY: 2,
    LEADER_SETTLE_TICKS: 5,
    MEMBER_INTERVAL: 3,
    MAX_RETRIES: 3,
    DEFAULT_Y: 120,
    MIN_Y: -64,
    MAX_Y: 320,
    MAX_SPAWN_RADIUS: 490,
});

class UhcMatchManagerTeleport {
    safeYCache = new Map();
    teleportQueueAbortHandlers = [];

    teleportManagerGetSafeY(dimension, x, z) {
        if (!Number.isFinite(x) || !Number.isFinite(z)) return TELEPORT_CONFIG.DEFAULT_Y;
        const key = `${x | 0},${z | 0}`;
        if (this.safeYCache.has(key)) return this.safeYCache.get(key);
        try {
            const block = dimension.getTopmostBlock({ x, z });
            if (!block) return TELEPORT_CONFIG.DEFAULT_Y;
            const isLiquid = block.typeId.includes('lava') || block.typeId.includes('water');
            if (isLiquid) {
                try {
                    dimension.runCommand(`setblock ${x | 0} ${block.y} ${z | 0} glass`);
                } catch (e) {
                    console.warn('[UHC] Failed to place safety platform block: ', e);
                }
            }
            const y = Math.max(TELEPORT_CONFIG.MIN_Y, Math.min(TELEPORT_CONFIG.MAX_Y, block.y + 1));
            if (this.safeYCache.size >= 256) this.safeYCache.delete(this.safeYCache.keys().next().value);
            this.safeYCache.set(key, y);
            return y;
        } catch {
            return TELEPORT_CONFIG.DEFAULT_Y;
        }
    }

    teleportManagerGroupByTeam() {
        const teamMap = new Map();
        const players = world.getPlayers();

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            if (!player?.isValid) continue;
            if (!player.hasTag('uhc')) continue;

            const tag = getPlayerTeam(player);
            if (!tag) continue;

            if (!teamMap.has(tag)) {
                teamMap.set(tag, []);
            }
            teamMap.get(tag).push(player);
        }
        return teamMap;
    }

    teleportManagerGenerateXZ(teamCount, radius) {
        const effectiveRadius = Math.min(radius, TELEPORT_CONFIG.MAX_SPAWN_RADIUS),
            angleStep = (Math.PI * 2) / teamCount,
            randomOffset = Math.random() * Math.PI * 2,
            positions = [];
        for (let i = 0; i < teamCount; i++) {
            const angle = randomOffset + i * angleStep;
            positions.push({
                x: (center.x + Math.cos(angle) * effectiveRadius) | 0,
                z: (center.z + Math.sin(angle) * effectiveRadius) | 0,
            });
        }
        return positions;
    }

    createValidTeam(teamData, targetPos) {
        if (!teamData || !targetPos) return null;

        const members = teamData[1];
        if (!members?.length) return null;

        const snapshot = members.filter((p) => p?.isValid && p.hasTag('uhc'));
        if (!snapshot.length) return null;

        return {
            snapshot,
            capturedX: targetPos.x,
            capturedZ: targetPos.z,
            teamTag: teamData[0],
        };
    }

    teleportLeaderToPreload(leader, x, z, dimension, teamTag) {
        try {
            leader.teleport({ x, y: TELEPORT_CONFIG.PRELOAD_Y, z }, { dimension });
            world.sendMessage(`${MinecraftColor.green}[DEBUG] Leader ${leader.name} (${teamTag}) teleported to preload position`);
            return true;
        } catch {
            world.sendMessage(`${MinecraftColor.red}[DEBUG] Leader ${leader.name} (${teamTag}) failed to teleport to preload position`);
            return false;
        }
    }

    createMemberQueueEntry(player, loc) {
        return {
            player,
            loc: { ...loc },
            retryCount: 0,
            maxRetries: TELEPORT_CONFIG.MAX_RETRIES,
        };
    }

    teleportPlayer(entry, dimension) {
        const { player, loc, retryCount } = entry;

        if (!player?.isValid || !player.hasTag('uhc')) {
            return { success: false, shouldRetry: false };
        }

        try {
            player.teleport(loc, { dimension });
            const role = retryCount > 0 ? `(retry ${retryCount})` : '';
            world.sendMessage(`${MinecraftColor.green}[DEBUG] ${player.name} teleported to final position ${role}`);
            return { success: true, shouldRetry: false };
        } catch {
            const shouldRetry = retryCount < entry.maxRetries;
            if (!shouldRetry) {
                world.sendMessage(`${MinecraftColor.red}[UHC] Failed to teleport ${player.name} after ${entry.maxRetries + 1} attempts`);
            }
            return { success: false, shouldRetry };
        }
    }

    teleportManagerRunQueue(teamsData, positions, dimension) {
        let totalOk = 0;
        let totalFail = 0;
        let aborted = false;

        const abort = () => {
            aborted = true;
        };
        this.teleportQueueAbortHandlers.push(abort);

        const removeAbortHandler = () => {
            const idx = this.teleportQueueAbortHandlers.indexOf(abort);
            if (idx !== -1) this.teleportQueueAbortHandlers.splice(idx, 1);
        };

        const finishQueue = () => {
            removeAbortHandler();
            const failMsg = totalFail > 0 ? ` ${MinecraftColor.red}fail:${totalFail}` : '';
            world.sendMessage(`[UHC] All teams teleported. ${MinecraftColor.gray}(Queue: ${totalOk}${failMsg}${MinecraftColor.gray})`);
        };

        const validTeams = [];

        for (let i = 0; i < teamsData.length; i++) {
            const validTeam = this.createValidTeam(teamsData[i], positions[i]);
            if (!validTeam) continue;
            validTeams.push(validTeam);
        }

        if (!validTeams.length) return finishQueue();

        let phase1Idx = 0;

        const processNextLeader = () => {
            if (aborted) {
                removeAbortHandler();
                return;
            }

            if (phase1Idx >= validTeams.length) {
                system.runTimeout(() => {
                    if (aborted) {
                        removeAbortHandler();
                        return;
                    }

                    this.processMemberQueue(
                        validTeams,
                        dimension,
                        finishQueue,
                        () => totalOk++,
                        () => totalFail++,
                        () => aborted,
                    );
                }, TELEPORT_CONFIG.LEADER_SETTLE_TICKS);
                return;
            }

            const validTeam = validTeams[phase1Idx++];
            const leader = validTeam.snapshot[0];
            const success = this.teleportLeaderToPreload(leader, validTeam.capturedX, validTeam.capturedZ, dimension, validTeam.teamTag);

            if (success) totalOk++;
            else totalFail++;

            system.runTimeout(processNextLeader, 1);
        };

        processNextLeader();
    }

    processMemberQueue(validTeams, dimension, finishCallback, onSuccess, onFail, isAborted) {
        const memberQueue = [];
        const retryQueue = [];

        for (let t = 0; t < validTeams.length; t++) {
            const { snapshot, capturedX, capturedZ } = validTeams[t];
            const safeY = this.teleportManagerGetSafeY(dimension, capturedX, capturedZ);
            const loc = { x: capturedX, y: safeY, z: capturedZ };

            for (let m = 0; m < snapshot.length; m++) {
                const player = snapshot[m];
                if (player?.isValid && player.hasTag('uhc')) {
                    memberQueue.push(this.createMemberQueueEntry(player, loc));
                }
            }
        }

        if (memberQueue.length === 0) return finishCallback();

        const totalPlayers = memberQueue.length;
        world.sendMessage(`${MinecraftColor.gray}[DEBUG] Phase 2: Starting teleport queue with ${totalPlayers} players`);

        let qIdx = 0;
        let processedRetries = false;
        let successCount = 0;
        let failCount = 0;

        const processNextMember = () => {
            if (isAborted()) {
                world.sendMessage(`${MinecraftColor.red}[DEBUG] Teleport queue aborted. Progress: ${qIdx}/${totalPlayers}`);
                return;
            }

            if (qIdx >= memberQueue.length) {
                if (retryQueue.length > 0 && !processedRetries) {
                    world.sendMessage(`${MinecraftColor.yellow}[DEBUG] Main queue complete. Processing ${retryQueue.length} retry entries`);
                    memberQueue.push(...retryQueue);
                    retryQueue.length = 0;
                    processedRetries = true;
                    world.sendMessage(`${MinecraftColor.cyan}[DEBUG] Retry phase started. Total queue size: ${memberQueue.length}`);
                } else {
                    world.sendMessage(`${MinecraftColor.green}[DEBUG] All teleports complete. Success: ${successCount}, Failed: ${failCount}, Total: ${totalPlayers}`);
                    return finishCallback();
                }
            }

            if (qIdx >= memberQueue.length) return finishCallback();

            const entry = memberQueue[qIdx++];
            const currentNum = qIdx;
            const totalNum = memberQueue.length;

            world.sendMessage(`${MinecraftColor.gray}[DEBUG] Player ${entry.player.name} (${currentNum}/${totalNum})`);

            const result = this.teleportPlayer(entry, dimension);

            if (result.success) {
                successCount++;
                onSuccess();
                world.sendMessage(`${MinecraftColor.green}[DEBUG] [/] ${entry.player.name} teleported successfully`);
            } else if (result.shouldRetry && !processedRetries) {
                const retryEntry = { ...entry, retryCount: entry.retryCount + 1 };
                retryQueue.push(retryEntry);

                world.sendMessage(`${MinecraftColor.yellow}[DEBUG] [x] ${entry.player.name} failed, added to retry queue (${retryQueue.length} pending)`);

                if (entry.retryCount === 0) {
                    world.sendMessage(`${MinecraftColor.yellow}[UHC] Retrying teleport for ${entry.player.name} (attempt ${entry.retryCount + 2}/${entry.maxRetries + 1})`);
                }
            } else {
                failCount++;
                onFail();

                if (result.shouldRetry && processedRetries) {
                    world.sendMessage(`${MinecraftColor.red}[DEBUG] [x] ${entry.player.name} final failure - retry phase already completed`);
                } else {
                    world.sendMessage(`${MinecraftColor.red}[DEBUG] [x] ${entry.player.name} failed - max attempts reached`);
                }
            }

            if (currentNum % 5 === 0 || currentNum === totalNum) {
                const phase = processedRetries ? 'Retry' : 'Main';
                const remaining = totalNum - currentNum;
                world.sendMessage(`${MinecraftColor.gray}[DEBUG] ${phase} Progress: ${currentNum}/${totalNum} processed, ${remaining} remaining (/:${successCount} x:${failCount})`);
            }

            system.runTimeout(processNextMember, TELEPORT_CONFIG.MEMBER_INTERVAL);
        };

        processNextMember();
    }

    teleportManagerTeleportTeam(radius) {
        if (radius === undefined) radius = ctx.borderRadius;
        if (!Number.isFinite(radius)) radius = ctx.borderRadius;

        if (!ctx.cachedDimension) {
            world.sendMessage(MinecraftColor.red + '[UHC] Error: Dimension not initialized');
            return;
        }

        const teamMap = this.teleportManagerGroupByTeam();
        const teamsData = Array.from(teamMap.entries());

        if (teamsData.length === 0) return;

        world.sendMessage(`${MinecraftColor.gray}[UHC] Spreading ${teamsData.length} teams...`);

        this.logTeamInfo(teamsData);

        const positions = this.teleportManagerGenerateXZ(teamsData.length, radius);
        this.teleportManagerRunQueue(teamsData, positions, ctx.cachedDimension);
    }

    logTeamInfo(teamsData) {
        for (let i = 0; i < teamsData.length; i++) {
            const [teamTag, members] = teamsData[i];
            const validMembers = members.filter((p) => p?.isValid && p.hasTag('uhc'));

            if (validMembers.length === 0) {
                world.sendMessage(`${MinecraftColor.gray}[DEBUG] ${teamTag}: 0 valid UHC players`);
                continue;
            }

            const leader = validMembers[0];
            const memberNames = validMembers
                .slice(1)
                .map((p) => p.name)
                .join(', ');
            const memberInfo = memberNames ? `${MinecraftColor.cyan} | Members: ${memberNames}` : '';

            world.sendMessage(`${MinecraftColor.gray}[DEBUG] ${teamTag}: ${validMembers.length} players` + `${MinecraftColor.yellow} | Leader: ${leader.name}${memberInfo}`);
        }
    }

    abortAllTeleportQueues() {
        for (let i = 0; i < this.teleportQueueAbortHandlers.length; i++) {
            this.teleportQueueAbortHandlers[i]();
        }
        this.teleportQueueAbortHandlers.length = 0;
    }
}

export default new UhcMatchManagerTeleport();
