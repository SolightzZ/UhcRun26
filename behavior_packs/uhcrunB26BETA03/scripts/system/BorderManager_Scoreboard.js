import { DisplaySlotId, ObjectiveSortOrder, world } from '@minecraft/server';
import { getPlayerTeam } from '../Manager/TeamManager.js';
import bf from './BlockFiller.js';
import bm, { borderEnd, CHECKPOINTS, ctx, icons, MinecraftColor } from './BorderManager.js';

const uhc = 'uhc';
const uhcName = MinecraftColor.h + MinecraftColor.n + 'UhcRun26';

const LINE_ID_SUFFIX = Array.from({ length: 10 }, (_, i) => '§r'.repeat(i + 1));

class BorderManagerScoreboard {
    scoreCache = new Map();

    clearCache() {
        this.scoreCache.clear();
    }

    scoreboardInit() {
        const score = world.scoreboard;
        const old = score.getObjective(uhc);
        if (old) score.removeObjective(old);
        const obj = score.addObjective(uhc, uhcName);
        score.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: obj, sortOrder: ObjectiveSortOrder.Descending });
        ctx.objective = obj;
        this.scoreCache.clear();
    }

    scoreboardClear() {
        const sb = world.scoreboard;
        sb.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
        const obj = sb.getObjective(uhc);
        if (obj) sb.removeObjective(obj);
        this.scoreCache.clear();
        ctx.objective = null;
    }

    scoreboardMakeLineId(text, index) {
        return `${text}${LINE_ID_SUFFIX[index] ?? '§r'.repeat(index + 1)}`;
    }

    scoreboardUpdateLine(obj, index, text) {
        const cache = this.scoreCache;
        const old = cache.get(index);

        if (old === text) return;

        if (old) obj.removeParticipant(this.scoreboardMakeLineId(old, index));

        obj.setScore(this.scoreboardMakeLineId(text, index), 10 - index);
        cache.set(index, text);
    }

    scoreboardComputeNextLabel() {
        const t = ctx.uhcTick;

        if (ctx.nextShrinkIndex >= CHECKPOINTS.length && ctx.targetRadius === null) {
            return bf.getEndSequenceLabel(t, ctx.endSeqState, ctx.endSeqStartTick, bf.fillHasPendingWork());
        }

        if (ctx.targetRadius != null) {
            const r = ctx.shrinkDuration - (t - ctx.shrinkStartTick);
            return `${Math.max(0, r)}s`;
        }

        const r = ctx.nextShrinkTick - t;
        return r > 0 ? `${r}s` : `${MinecraftColor.darkBlue}NOW`;
    }

    scoreboardComputeNextBorder() {
        if (ctx.targetRadius != null) return ctx.targetRadius;
        if (ctx.nextShrinkIndex >= CHECKPOINTS.length) return borderEnd;
        return CHECKPOINTS[ctx.nextShrinkIndex];
    }

    scoreboardCollectAliveTeams(players) {
        const aliveTeams = new Set();

        for (let i = 0, len = players.length; i < len; i++) {
            const player = players[i];
            const teamId = getPlayerTeam(player);

            if (teamId) aliveTeams.add(teamId);
        }

        return aliveTeams;
    }

    scoreboardGetAliveTeamBar(players) {
        if (ctx.aliveTeamDirty) {
            const aliveTeams = this.scoreboardCollectAliveTeams(players);

            if (aliveTeams.size) {
                let result = '';

                const teams = bm.getTeamsCached();
                for (let i = 0, len = teams.length; i < len; i++) {
                    const team = teams[i];

                    if (aliveTeams.has(team.id)) {
                        result += team.color + '▒';
                    }
                }

                ctx.aliveTeamBarCache = result;
            } else {
                ctx.aliveTeamBarCache = MinecraftColor.gray + '-';
            }

            ctx.aliveTeamDirty = false;
        }

        return ctx.aliveTeamBarCache;
    }

    scoreboardGetGameState() {
        if (!ctx.isRunning) return `${icons.Hourglass}`;
        if (ctx.uhcTick < 30) return `?`;
        if (!world.gameRules.pvp) return `${icons.shield}`;
        if (ctx.nextShrinkIndex < CHECKPOINTS.length) return `${icons.Sword}`;
        return `?`;
    }

    scoreboardUpdate(obj, uhcPlayers) {
        const c = ctx.targetRadius !== null ? MinecraftColor.red : MinecraftColor.white,
            pCount = uhcPlayers.length;

        if (ctx.borderRadius !== ctx.lastBorderRadius || ctx.targetRadius !== ctx.lastTargetRadius) {
            this.scoreboardUpdateLine(obj, 0, `${c}${icons.Border} ${ctx.borderRadius}${MinecraftColor.gray}/${this.scoreboardComputeNextBorder()}`);
            ctx.lastBorderRadius = ctx.borderRadius;
            ctx.lastTargetRadius = ctx.targetRadius;
        }

        this.scoreboardUpdateLine(obj, 1, `${c}${this.scoreboardComputeNextLabel()}`);

        if (pCount !== ctx.lastPlayerCount) {
            this.scoreboardUpdateLine(obj, 2, `${c}${icons.Bot} ${MinecraftColor.white}${pCount}`);
            ctx.lastPlayerCount = pCount;
        }

        this.scoreboardUpdateLine(obj, 3, this.scoreboardGetAliveTeamBar(uhcPlayers));
        this.scoreboardUpdateLine(obj, 4, this.scoreboardGetGameState());
    }
}

export default new BorderManagerScoreboard();
