import { system, world } from '@minecraft/server';
import {
   getAllPlayers,
   getPlayerTeam,
   getTeamInfo,
   showVictoryMessage,
} from '../Manager/TeamManager.js';
import { SND_PLING } from '../plugin/Util.js';
import bm, { ctx, icons, MinecraftColor } from './BorderManager.js';
import umm from './UhcMatchManager.js';

//ตรวจสอบผู้ชนะ: นับทีมที่เหลือรอด, แสดงข้อความชนะ/เสมอ, นับถอยหลังจบเกม
class UhcMatchManagerVictory {
   countdownRunning = false;
   countdownIntervalId = null;
   aliveTeamsSet = new Set();

   // เสมอ: ไม่มีทีมเหลือรอด
   victoryManagerTriggerDraw() {
      if (!ctx.isRunning) return;
      ctx.isRunning = false;
      umm.stopGameLoop();
      world.gameRules.pvp = false;
      bm.broadcast(getAllPlayers(), { message: '[x]: No Team Survived', sound: SND_PLING });
      this.victoryManagerStartCountdown();
   }

   // เริ่มนับถอยหลัง 10 วิ ก่อนจบเกม
   victoryManagerStartCountdown() {
      if (this.countdownRunning) return;
      this.countdownRunning = true;

      let time = 10;

      this.countdownIntervalId = system.runInterval(() => {
         time--;

         if (time <= 5 && time > 0) {
            world.sendMessage(`${MinecraftColor.red}${icons.Hourglass} Game ending in ${time}`);
         }

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

   // ทีม winTag ชนะ
   victoryManagerTriggerWin(winTag) {
      if (!ctx.isRunning) return;

      ctx.isRunning = false;
      umm.stopGameLoop();
      world.gameRules.pvp = false;

      const teamInfo = getTeamInfo(winTag);
      const teamName = teamInfo ? `${teamInfo.color}${teamInfo.name}` : winTag;
      const players = getAllPlayers();

      for (let i = 0; i < players.length; i++) {
         const p = players[i];

         if (!p?.isValid || getPlayerTeam(p) !== winTag) continue;

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
               console.error('[Victory] Failed to spawn victory particle:', error);
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

   // ยกเลิก countdown
   resetCountdownRunning() {
      if (this.countdownIntervalId !== null) {
         system.clearRun(this.countdownIntervalId);
         this.countdownIntervalId = null;
      }
      this.countdownRunning = false;
   }
}

export default new UhcMatchManagerVictory();
