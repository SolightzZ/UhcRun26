import { system, world } from '@minecraft/server';
import { showVictoryMessage } from '../../features/team/TeamManager.js';
import { SND_PLING, logError } from '../../shared/Util.js';
import bm, { MinecraftColor, ctx, icons } from '../border/BorderManager.js';
import { recordGamesPlayed, recordPlacement, recordWin } from '../rank/RankData.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { getCachedPlayers, getPlayerTeam, getPlayersByTeam } from '../team/TeamActions.js';
import matchManager from './MatchManager.js';

class UhcMatchManagerVictory {
   countdownRunning = false;
   aliveTeamsSet = new Set();
   _prevAliveTeams = new Set();

   victoryManagerTriggerDraw() {
      if (!ctx.isRunning) return;
      ctx.isRunning = false;
      matchManager.stopGameLoop();
      world.gameRules.pvp = false;

      const allPlayerNames = matchManager.getUhcPlayersCached().map((p) => p.name);
      recordGamesPlayed(allPlayerNames);

      bm.broadcast(getCachedPlayers(), { message: '[x]: No Team Survived', sound: SND_PLING });
      this.victoryManagerStartCountdown();
   }

   victoryManagerStartCountdown() {
      if (this.countdownRunning) return;
      this.countdownRunning = true;

      let time = 10;

      ctx.countdownIntervalId = system.runInterval(() => {
         time--;

         if (time <= 5 && time > 0) {
            world.sendMessage(`${MinecraftColor.red}${icons.Hourglass} Game ending in ${time}`);
         }

         if (time <= 0) {
            if (ctx.countdownIntervalId !== null) {
               system.clearRun(ctx.countdownIntervalId);
               ctx.countdownIntervalId = null;
            }

            this.countdownRunning = false;
            matchManager.endGameUhc();
         }
      }, 20);
   }

   victoryManagerTriggerWin(winTag) {
      if (!ctx.isRunning) return;

      ctx.isRunning = false;
      matchManager.stopGameLoop();
      world.gameRules.pvp = false;

      const allPlayerNames = matchManager.getUhcPlayersCached().map((p) => p.name);
      const winPlayers = getPlayersByTeam(winTag).map((p) => p.name);
      recordWin(winTag, winPlayers);
      recordGamesPlayed(allPlayerNames);

      const teamInfo = TEAM_LOOKUP.get(winTag) ?? null;
      const teamName = teamInfo ? `${teamInfo.color}${teamInfo.name}` : winTag;
      const players = getCachedPlayers();
      const winningPlayers = getPlayersByTeam(winTag);

      for (let i = 0, len = winningPlayers.length; i < len; i++) {
         const p = winningPlayers[i];

         if (!p?.isValid) continue;

         const loc = p.location,
            dim = p.dimension;

         if (loc && dim) {
            try {
               dim.spawnParticle('minecraft:huge_explosion_emitter', {
                  x: loc.x,
                  y: loc.y + 2.5,
                  z: loc.z,
               });
            } catch (error) {
               logError('Victory', 'Failed to spawn victory particle', error);
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

      const players = matchManager.getUhcPlayersCached();

      if (!players.length) {
         this.victoryManagerTriggerDraw();
         return;
      }

      this.aliveTeamsSet.clear();

      for (let i = 0; i < players.length; i++) {
         const tag = getPlayerTeam(players[i]);
         if (!tag) continue;

         this.aliveTeamsSet.add(tag);
         if (this.aliveTeamsSet.size > 1) {
            this._detectEliminatedTeams();
            this._prevAliveTeams.clear();
            for (const t of this.aliveTeamsSet) this._prevAliveTeams.add(t);
            return;
         }
      }

      this._detectEliminatedTeams();
      this._prevAliveTeams.clear();

      if (this.aliveTeamsSet.size === 1) {
         this.victoryManagerTriggerWin(this.aliveTeamsSet.values().next().value);
         return;
      }

      this.victoryManagerTriggerDraw();
   }

   // detect newly eliminated teams (in prev but not in curr)
   _detectEliminatedTeams() {
      if (this._prevAliveTeams.size === 0) return;

      for (const teamId of this._prevAliveTeams) {
         if (!this.aliveTeamsSet.has(teamId)) {
            const placement = this.aliveTeamsSet.size + 1;
            recordPlacement(teamId, placement);
         }
      }
   }

   resetCountdownRunning() {
      if (ctx.countdownIntervalId !== null) {
         system.clearRun(ctx.countdownIntervalId);
         ctx.countdownIntervalId = null;
      }
      this.countdownRunning = false;
   }
}

export default new UhcMatchManagerVictory();
