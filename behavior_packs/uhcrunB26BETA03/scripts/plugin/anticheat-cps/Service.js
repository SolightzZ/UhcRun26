import { system } from '@minecraft/server';
import { enqueuePlayerMessage, enqueuePlayerSound, enqueuePlayerSetActionBar } from '../../shared/MessageBatcher.js';
import { logError, logWarn } from '../../shared/Util.js';
import model from './Model.js';

class Service {
   // บัฟเฟอร์เก็บข้อมูล 8 บิตต่ำสุดของติ๊ก → ประกอบติ๊กเต็มรูปแบบใหม่จากฐาน
   countRecentHits = (data, currentTick) => {
      const cutoff = currentTick - model.WINDOW_TICKS;
      const baseTick = currentTick & 0xffffff00;
      let validCount = 0;
      for (let i = 0; i < data.count; i++) {
         const idx = (data.head - 1 - i + model.BUF_SIZE) % model.BUF_SIZE;
         let tickVal = baseTick | data.buf[idx];

         // การแก้ไขค่าเมื่อเกิดการวนทับ: หาก tickVal เกินกว่า currentTick ตั้งแต่ 128 ขึ้นไป ให้หักออก 256
         if (tickVal > currentTick && tickVal - currentTick >= 128) tickVal -= 256;
         if (tickVal > cutoff) validCount++;
         else break;
      }
      return validCount;
   };

   warnPlayer = (player, cps) => {
      if (!player?.isValid) return;
      enqueuePlayerSetActionBar(player, `§c[CPS Warning] Click Speed: ${cps} CPS (Limit: ${model.MAX_CPS})`);
      enqueuePlayerSound(player, 'note.bass', { volume: 0.8, pitch: 0.5 });
   };

   alertAdmins = (attacker, cps) => {
      if (!attacker?.isValid) return;
      const safeName = attacker.name.replace(/"/g, '\\"').replace(/§/g, '');
      logWarn('CPS', `${safeName} is clicking fast: ${cps} hits/${model.WINDOW_TICKS} ticks`);

      system.run(() => {
         const admins = [...model.adminPlayers.values()].filter(p => p?.isValid);
         if (admins.length === 0) return;
         enqueuePlayerMessage(admins, `§c[CPS Anticheat] §e${safeName} §7approaching click limit: §f${cps} CPS`);
         enqueuePlayerSound(admins, 'random.screenshot', { volume: 0.5, pitch: 1.0 });
      });
   };

   kickPlayer = (player, cps) => {
      if (!player?.isValid) return;
      const safeName = player.name.replace(/"/g, '\\"').replace(/§/g, '');
      const kickMessage = `\nUHCRun\n§c[CPS] ${safeName} ${cps}/${model.MAX_CPS} (Auto-cheat)`;
      logWarn('CPS', `${safeName} kicked: ${cps} hits/${model.WINDOW_TICKS} ticks`);

      system.run(() => {
         if (!player?.isValid) return;
         player.dimension.runCommand(`kick "${safeName}" ${kickMessage}`).catch((error) => {
            logError('CPS', 'Kick command failed', error);
         });
      });
   };
}

export default new Service();
