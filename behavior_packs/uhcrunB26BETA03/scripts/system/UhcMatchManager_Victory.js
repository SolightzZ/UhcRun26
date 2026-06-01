import { system, world } from '@minecraft/server';
import { getAllPlayers, getPlayerTeam, getTeamInfo, showVictoryMessage } from '../Manager/TeamManager.js';
import bm, { ctx, icons, MinecraftColor } from './BorderManager.js';
import umm from './UhcMatchManager.js';

class UhcMatchManagerVictory {
    countdownRunning = false;
    countdownIntervalId = null;
    aliveTeamsSet = new Set();

    victoryManagerTriggerDraw() {
        if (!ctx.isRunning) return;
        ctx.isRunning = false;
        umm.stopGameLoop();
        world.gameRules.pvp = false;
        bm.broadcast(getAllPlayers(), { message: '[x]: No Team Survived', sound: 'note.pling' });
        this.victoryManagerStartCountdown();
    }

    victoryManagerStartCountdown() {
        if (this.countdownRunning) return;
        this.countdownRunning = true;
        let time = 10;
        this.countdownIntervalId = system.runInterval(() => {
            time--;
            if (time <= 5 && time > 0) world.sendMessage(`${MinecraftColor.red}${icons.Hourglass} Game ending in ${time}`);
            if (time <= 0) {
                if (this.countdownIntervalId !== null) {
                    system.clearRun(this.countdownIntervalId);
                    this.countdownIntervalId = null;
                }
                this.countdownRunning = false;
                umm.endGameUhc();
            }
        }, 20);
    }

    victoryManagerTriggerWin(winTag) {
        if (!ctx.isRunning) return;
        ctx.isRunning = false;
        umm.stopGameLoop();
        world.gameRules.pvp = false;

        const teamInfo = getTeamInfo(winTag),
            teamName = teamInfo ? `${teamInfo.color}${teamInfo.name}` : winTag,
            players = getAllPlayers();

        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            if (!p?.isValid || getPlayerTeam(p) !== winTag) continue;
            const loc = p.location,
                dim = p.dimension;
            if (loc && dim) {
                try {
                    dim.spawnParticle('minecraft:huge_explosion_emitter', { x: loc.x, y: loc.y + 2.5, z: loc.z });
                } catch (e) {
                    console.warn('[Victory] Failed to spawn victory particle:', e);
                }
            }
        }

        showVictoryMessage(winTag, ctx.uhcTick);
        bm.broadcast(players, {
            title: MinecraftColor.white + 'VICTORY',
            subtitle: `${teamName} Wins`,
            sound: 'win',
        });
        this.victoryManagerStartCountdown();
    }

    victoryManagerCheck() {
        if (!ctx.isRunning) return;

        const players = umm.getUhcPlayersCached();
        if (!players.length) {
            this.victoryManagerTriggerDraw();
            return;
        }

        this.aliveTeamsSet.clear();

        for (let i = 0; i < players.length; i++) {
            const tag = getPlayerTeam(players[i]);
            if (!tag) continue;

            this.aliveTeamsSet.add(tag);
            if (this.aliveTeamsSet.size > 1) return;
        }

        if (this.aliveTeamsSet.size === 1) {
            this.victoryManagerTriggerWin(this.aliveTeamsSet.values().next().value);
            return;
        }

        this.victoryManagerTriggerDraw();
    }

    resetCountdownRunning() {
        if (this.countdownIntervalId !== null) {
            system.clearRun(this.countdownIntervalId);
            this.countdownIntervalId = null;
        }
        this.countdownRunning = false;
    }
}

export default new UhcMatchManagerVictory();
