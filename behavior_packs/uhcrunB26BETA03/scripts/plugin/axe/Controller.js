import { system } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

// แคชรูปแบบบล็อกอากาศ (Air Block Permutation) ล่วงหน้าตอนเริ่มต้นระบบ
system.run(() => {
   model.getAir();
});

class Controller {
   onPlayerBreakBlock = (ev) => {
      service.onPlayerBreakBlock(ev);
   };

   onPlayerLeave = ({ playerId }) => {
      model.lastFellTick.delete(playerId);
      model.playerJobCount.delete(playerId);
      model.lastEnqueueTick.delete(playerId);
   };
}

export default new Controller();
