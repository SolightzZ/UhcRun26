import { system, world } from '@minecraft/server';
import { getAllPlayers, getPlayerTeam, getTeamInfo, showVictoryMessage } from '../Manager/TeamManager.js';
import bm, { ctx, icons, MinecraftColor } from './BorderManager.js';
import umm from './UhcMatchManager.js';

const explosionLocPool = { x: 0, y: 0, z: 0 };

class UhcMatchManagerVictory {
    countdownRunning = false;
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
        const id = system.runInterval(() => {
            time--;
            if (time <= 5 && time > 0) world.sendMessage(`${MinecraftColor.red}${icons.Hourglass} Game ending in ${time}`);
            if (time <= 0) {
                system.clearRun(id);
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
                explosionLocPool.x = loc.x;
                explosionLocPool.y = loc.y + 2.5;
                explosionLocPool.z = loc.z;
                dim.spawnParticle('minecraft:huge_explosion_emitter', explosionLocPool);
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
        this.countdownRunning = false;
    }
}

export default new UhcMatchManagerVictory();
