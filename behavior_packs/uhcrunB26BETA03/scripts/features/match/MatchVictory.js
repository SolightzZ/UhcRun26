import { system, world } from '@minecraft/server';
import { showVictoryMessage } from '../../features/team/TeamManager.js';
import { getCachedPlayers, getPlayerTeam, getPlayersByTeam } from '../team/TeamActions.js';
import { TEAM_LOOKUP } from '../team/State_Team.js';
import { SND_PLING, logError } from '../../shared/Util.js';
import bm, { ctx, icons, MinecraftColor } from '../border/BorderManager.js';
import { recordPlacement, recordGamesPlayed, recordWin } from '../rank/RankData.js';
import matchManager from './MatchManager.js';

//ตรวจสอบผู้ชนะ: นับทีมที่เหลือรอด, แสดงข้อความชนะ/เสมอ, นับถอยหลังจบเกม
class UhcMatchManagerVictory {
   countdownRunning = false;
   aliveTeamsSet = new Set();
   _prevAliveTeams = new Set();

   // เสมอ: ไม่มีทีมเหลือรอด
   victoryManagerTriggerDraw() {
      if (!ctx.isRunning) return;
      ctx.isRunning = false;
      matchManager.stopGameLoop();
      world.gameRules.pvp = false;

      // บันทึกสถิติ Rank: ทุกคนได้เล่น +1 เกม (ไม่มีผู้ชนะ)
      const allPlayerIds = matchManager.getUhcPlayersCached().map((p) => p.id);
      recordGamesPlayed(allPlayerIds);

      bm.broadcast(getCachedPlayers(), { message: '[x]: No Team Survived', sound: SND_PLING });
      this.victoryManagerStartCountdown();
   }

   // เริ่มนับถอยหลัง 10 วิ ก่อนจบเกม
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

   // ทีม winTag ชนะ
   victoryManagerTriggerWin(winTag) {
      if (!ctx.isRunning) return;

      ctx.isRunning = false;
      matchManager.stopGameLoop();
      world.gameRules.pvp = false;

      // บันทึกสถิติ Rank: ทีมชนะได้อันดับ 1 + ทุกคนได้เล่น +1 เกม
      const allPlayerIds = matchManager.getUhcPlayersCached().map((p) => p.id);
      const winPlayers = getPlayersByTeam(winTag).map((p) => p.id);
      recordWin(winTag, winPlayers);
      recordGamesPlayed(allPlayerIds);

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

   // ตรวจสอบว่าเหลือกี่ทีม ถ้าเหลือ 1 ทีม = ชนะ
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
            // ตรวจจับทีมที่ตกรอบ (มีใน prev แต่ไม่มีใน curr)
            this._detectEliminatedTeams();
            this._prevAliveTeams.clear();
            for (const t of this.aliveTeamsSet) this._prevAliveTeams.add(t);
            return;
         }
      }

      // ตรวจจับทีมที่ตกรอบ (มีใน prev แต่ไม่มีใน curr)
      this._detectEliminatedTeams();
      this._prevAliveTeams.clear();

      if (this.aliveTeamsSet.size === 1) {
         this.victoryManagerTriggerWin(this.aliveTeamsSet.values().next().value);
         return;
      }

      this.victoryManagerTriggerDraw();
   }

   // ตรวจจับทีมที่เพิ่งตกรอบ (อยู่ใน prev แต่หายไป)
   _detectEliminatedTeams() {
      if (this._prevAliveTeams.size === 0) return;

      for (const teamId of this._prevAliveTeams) {
         if (!this.aliveTeamsSet.has(teamId)) {
            const placement = this.aliveTeamsSet.size + 1;
            recordPlacement(teamId, placement);
         }
      }
   }

   // ยกเลิก countdown
   resetCountdownRunning() {
      if (ctx.countdownIntervalId !== null) {
         system.clearRun(ctx.countdownIntervalId);
         ctx.countdownIntervalId = null;
      }
      this.countdownRunning = false;
   }
}

export default new UhcMatchManagerVictory();
