import { system, world } from '@minecraft/server';
import { showVictoryMessage } from '../../features/team/TeamManager.js';
import { enqueueBroadcast } from '../../shared/MessageBatcher.js';
import { SND_PLING, logError } from '../../shared/Util.js';
import BorderManager from '../border/BorderManager.js';
import { MinecraftColor, ctx, icons } from '../border/BorderState.js';
import { recordGamesPlayed, recordPlacement, recordWin } from '../rank/RankData.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { getCachedPlayers, getPlayerTeam, getPlayersByTeam } from '../team/TeamActions.js';
import MatchManager from './MatchManager.js';
import { countdownRunning, setCountdownRunning } from './State_Game.js';

class UhcMatchManagerVictory {
   aliveTeamsSet = new Set();
   _prevAliveTeams = new Set();

   victoryManagerTriggerDraw() {
      if (!ctx.isRunning) return;
      ctx.isRunning = false;
      MatchManager.stopGameLoop();
      world.gameRules.pvp = false;

      const uhcPlayers1 = MatchManager.getUhcPlayersCached();
      const allPlayerNames = [];
      for (let mi = 0; mi < uhcPlayers1.length; mi++) allPlayerNames.push(uhcPlayers1[mi].name);
      recordGamesPlayed(allPlayerNames);

      BorderManager.broadcast(getCachedPlayers(), { message: '[x]: No Team Survived', sound: SND_PLING });
      this.victoryManagerStartCountdown();
   }

   victoryManagerStartCountdown() {
      if (countdownRunning) return;
      setCountdownRunning(true);

      let time = 10;

      ctx.countdownIntervalId = system.runInterval(() => {
         time--;

         if (time <= 5 && time > 0) {
            enqueueBroadcast(`${MinecraftColor.red}${icons.Hourglass} Game ending in ${time}`);
         }

         if (time <= 0) {
            if (ctx.countdownIntervalId !== null) {
               system.clearRun(ctx.countdownIntervalId);
               ctx.countdownIntervalId = null;
            }
            setCountdownRunning(false);
            MatchManager.endGameUhc();
         }
      }, 20);
   }

   victoryManagerTriggerWin(winTag) {
      if (!ctx.isRunning) return;

      ctx.isRunning = false;
      MatchManager.stopGameLoop();
      world.gameRules.pvp = false;

      const uhcPlayers2 = MatchManager.getUhcPlayersCached();
      const allPlayerNames = [];
      for (let mi = 0; mi < uhcPlayers2.length; mi++) allPlayerNames.push(uhcPlayers2[mi].name);
      const winPlayersArr = getPlayersByTeam(winTag);
      const winPlayers = [];
      for (let wi = 0; wi < winPlayersArr.length; wi++) winPlayers.push(winPlayersArr[wi].name);
      recordWin(winTag, winPlayers);
      recordGamesPlayed(allPlayerNames);

      const teamInfo = TEAM_LOOKUP.get(winTag) ?? null;
      const teamName = teamInfo ? `${teamInfo.color}${teamInfo.name}` : winTag;
      const players = getCachedPlayers();
      const winningPlayers = getPlayersByTeam(winTag);

      const particleTargets = [];
      for (let i = 0, len = winningPlayers.length; i < len; i++) {
         const p = winningPlayers[i];
         if (!p?.isValid) continue;
         const loc = p.location;
         if (!loc || !p.dimension) continue;
         particleTargets.push({ dim: p.dimension, x: loc.x, y: loc.y + 2.5, z: loc.z });
      }

      const PARTICLE_BATCH = 6;
      let pi = 0;
      const particleTask = system.runInterval(() => {
         try {
            const end = Math.min(pi + PARTICLE_BATCH, particleTargets.length);
            for (; pi < end; pi++) {
               const pt = particleTargets[pi];
               pt.dim.spawnParticle('minecraft:huge_explosion_emitter', { x: pt.x, y: pt.y, z: pt.z });
            }
            if (pi >= particleTargets.length) {
               system.clearRun(particleTask);
            }
         } catch (error) {
            logError('Victory', 'Failed to spawn victory particle', error);
            system.clearRun(particleTask);
         }
      }, 2);

      showVictoryMessage(winTag, ctx.uhcTick);

      BorderManager.broadcast(players, {
         title: MinecraftColor.white + 'VICTORY',
         subtitle: `${teamName} Wins`,
         sound: 'warzone-Plunder-You-Placed-1st',
      });

      this.victoryManagerStartCountdown();
   }

   victoryManagerCheck() {
      if (!ctx.isRunning) return;

      const players = MatchManager.getUhcPlayersCached();

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
            this.aliveTeamsSet.forEach((t) => this._prevAliveTeams.add(t));
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

   _detectEliminatedTeams() {
      if (this._prevAliveTeams.size === 0) return;

      this._prevAliveTeams.forEach((teamId) => {
         if (!this.aliveTeamsSet.has(teamId)) {
            const placement = this.aliveTeamsSet.size + 1;
            recordPlacement(teamId, placement);
         }
      });
   }
}

export default new UhcMatchManagerVictory();
