import service from './Service.js';

class Controller {
   onItemCompleteUse = (ev) => {
      const player = ev.source;
      if (!player?.isValid) return;

      const item = ev.itemStack;
      if (!item) return;

      service.handleConsume(player, item);
   };
}

export default new Controller();
