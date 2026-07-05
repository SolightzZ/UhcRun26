import { DisplaySlotId, ObjectiveSortOrder, world } from '@minecraft/server';
import bf from '../block-filler/BlockFiller.js';
import { getPlayerTeam } from '../team/TeamActions.js';
import bm, { borderEnd, CHECKPOINTS, ctx, icons, MinecraftColor, renderCache } from './BorderManager.js';

const uhc = 'uhc';
const uhcName = '§h§nUhcRun26';

const LINE_ID_SUFFIX = Array.from({ length: 10 }, (_, i) => '§r'.repeat(i + 1));
const _aliveTeams = new Set();

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

      score.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, {
         objective: obj,
         sortOrder: ObjectiveSortOrder.Descending,
      });

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
      const tick = ctx.uhcTick;

      if (ctx.nextShrinkIndex >= CHECKPOINTS.length && ctx.targetRadius === null) {
         return bf.getEndSequenceLabel(tick, ctx.endSeqState, ctx.endSeqStartTick, bf.fillHasPendingWork());
      }

      if (ctx.targetRadius != null) {
         const remaining = ctx.shrinkDuration - (tick - ctx.shrinkStartTick);
         return `${Math.max(0, remaining)}s`;
      }

      const remaining = ctx.nextShrinkTick - tick;
      return remaining > 0 ? `${remaining}s` : `${MinecraftColor.darkBlue}NOW`;
   }

   scoreboardComputeNextBorder() {
      if (ctx.targetRadius != null) return ctx.targetRadius;
      if (ctx.nextShrinkIndex >= CHECKPOINTS.length) return borderEnd;
      return CHECKPOINTS[ctx.nextShrinkIndex];
   }

   scoreboardCollectAliveTeams(players) {
      _aliveTeams.clear();

      for (let i = 0, len = players.length; i < len; i++) {
         const player = players[i];
         const teamId = getPlayerTeam(player);

         if (teamId) _aliveTeams.add(teamId);
      }

      return _aliveTeams;
   }

   scoreboardGetAliveTeamBar(players) {
      if (renderCache.aliveTeamDirty) {
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

            renderCache.aliveTeamBarCache = result;
         } else {
            renderCache.aliveTeamBarCache = MinecraftColor.gray + '-';
         }

         renderCache.aliveTeamDirty = false;
      }

      return renderCache.aliveTeamBarCache;
   }

   scoreboardGetGameState() {
      return bm.getGameState();
   }

   scoreboardUpdate(obj, uhcPlayers) {
      const color = ctx.targetRadius !== null ? MinecraftColor.red : MinecraftColor.white,
         pCount = uhcPlayers.length;

      if (ctx.borderRadius !== renderCache.lastBorderRadius || ctx.targetRadius !== renderCache.lastTargetRadius) {
         this.scoreboardUpdateLine(obj, 0, `${color}${icons.Border} ${ctx.borderRadius}${MinecraftColor.gray}/${this.scoreboardComputeNextBorder()}`);
         renderCache.lastBorderRadius = ctx.borderRadius;
         renderCache.lastTargetRadius = ctx.targetRadius;
      }

      this.scoreboardUpdateLine(obj, 1, `${color}${this.scoreboardComputeNextLabel()}`);

      if (pCount !== renderCache.lastPlayerCount) {
         this.scoreboardUpdateLine(obj, 2, `${color}${icons.Bot} ${MinecraftColor.white}${pCount}`);
         renderCache.lastPlayerCount = pCount;
      }

      this.scoreboardUpdateLine(obj, 3, this.scoreboardGetAliveTeamBar(uhcPlayers));
      this.scoreboardUpdateLine(obj, 4, this.scoreboardGetGameState());
   }
}

export default new BorderManagerScoreboard();
