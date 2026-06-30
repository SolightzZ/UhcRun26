import { system } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

// self-register: pre-cache air block type
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
