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

      const allPlayerNames = MatchManager.getUhcPlayersCached().map((p) => p.name);
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

      const allPlayerNames = MatchManager.getUhcPlayersCached().map((p) => p.name);
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

      BorderManager.broadcast(players, {
         title: MinecraftColor.white + 'VICTORY',
         subtitle: `${teamName} Wins`,
         sound: 'win',
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

   // ตรวจจับทีมที่เพิ่งถูกคัดออกใหม่ (มีอยู่ในก่อนหน้า แต่ไม่มีในปัจจุบัน)
   _detectEliminatedTeams() {
      if (this._prevAliveTeams.size === 0) return;

      for (const teamId of this._prevAliveTeams) {
         if (!this.aliveTeamsSet.has(teamId)) {
            const placement = this.aliveTeamsSet.size + 1;
            recordPlacement(teamId, placement);
         }
      }
   }
}

export default new UhcMatchManagerVictory();
