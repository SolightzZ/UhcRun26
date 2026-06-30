import { applyKnockbackXZ, normalizeXZ } from '../../shared/Util.js';
import model from './Model.js';

class Service {
   // เช็คว่า target และ source เป็นผู้เล่นคนละคน
   isValidPvP = (a, b) => a?.isValid && b?.isValid && a.typeId === model.PLAYER_ID && b.typeId === model.PLAYER_ID && a.id !== b.id;

   // กระเด้ง target ตามทิศทางที่ source มอง
   applyKnockback = (target, source) => {
      if (!this.isValidPvP(target, source)) return;
      const dir = source.getViewDirection();
      const { nx, nz } = normalizeXZ(dir.x, dir.z);
      applyKnockbackXZ(target, nx, nz, model.KB_H, model.KB_V, model.KB_H);
   };
}

export default new Service();
