import { system } from '@minecraft/server';
import { logError, logWarn } from '../../shared/Util.js';
import model from './Model.js';

class Service {
    // buf stores low 8 bits of tick → reconstruct full tick from base
   countRecentHits = (data, currentTick) => {
      const cutoff = currentTick - model.WINDOW_TICKS;
      const baseTick = currentTick & 0xffffff00;
      let validCount = 0;
      for (let i = 0; i < data.count; i++) {
         const idx = (data.head - 1 - i + model.BUF_SIZE) % model.BUF_SIZE;
         let tickVal = baseTick | data.buf[idx];
         // Wrap correction: if tickVal overshoots currentTick by ≥128, subtract 256
         if (tickVal > currentTick && tickVal - currentTick >= 128) tickVal -= 256;
         if (tickVal > cutoff) validCount++;
         else break;
      }
      return validCount;
   };

   warnPlayer = (player, cps) => {
      if (!player?.isValid) return;
      player.onScreenDisplay.setActionBar(`§c[CPS Warning] Click Speed: ${cps} CPS (Limit: ${model.MAX_CPS})`);
      player.playSound('note.bass', { volume: 0.8, pitch: 0.5 });
   };

   alertAdmins = (attacker, cps) => {
      if (!attacker?.isValid) return;
      const safeName = attacker.name.replace(/"/g, '\\"').replace(/§/g, '');
      logWarn('CPS', `${safeName} is clicking fast: ${cps} hits/${model.WINDOW_TICKS} ticks`);

      system.run(() => {
         for (const [, p] of model.adminPlayers) {
            if (p?.isValid) {
               p.sendMessage(`§c[CPS Anticheat] §e${safeName} §7approaching click limit: §f${cps} CPS`);
               p.playSound('random.screenshot', { volume: 0.5, pitch: 1.0 });
            }
         }
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
