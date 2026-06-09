import { system } from '@minecraft/server';
import { getPlayerInventoryContainer } from '../Util.js';
import model from './Model.js';
import service from './Service.js';

class Controller {
   // ลดความทนทานเบ็ดตกปลา 2 ขีดทุกครั้งที่ดีด PvP
   applyRodDurabilityWear = (source) => {
      const inv = getPlayerInventoryContainer(source);

      if (!inv) return;

      const slot = source.selectedSlotIndex;

      const item = inv.getItem(slot);

      if (item?.typeId !== 'minecraft:fishing_rod') return;

      const dur = item.getComponent('minecraft:durability');

      if (!dur) return;

      const prev = dur.damage;
      // ลดความทนทาน 2 เมื่อดีด PvP
      dur.damage = Math.min(dur.damage + 2, dur.maxDurability);

      if (dur.damage >= dur.maxDurability) {
         inv.setItem(slot, undefined);

         source.playSound('random.break', { location: source.location });
      } else if (dur.damage !== prev) {
         inv.setItem(slot, item);
      }
   };

   // เมื่อเบ็ดตกปลาตีผู้เล่น ให้กระเด้ง + ลดความทนทาน
   onProjectileHitEntity = (ev) => {
      const { projectile: proj, source } = ev;
      if (proj?.typeId !== model.HOOK_ID) return;
      if (!source?.isValid) return;

      const target = ev.getEntityHit()?.entity;
      if (!service.isValidPvP(target, source)) return;

      service.applyKnockback(target, source);

      this.applyRodDurabilityWear(source);

      source.playSound(model.CAST_SOUND, model.SOUND_OPTS);

      system.run(() => {
         if (proj?.isValid) proj.remove();
      });
   };
}

export default new Controller();
