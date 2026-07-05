import Model from './Model.js';
import service, { isValidTool } from './Service.js';

class Controller {
   onPlayerLeave = (ev) => {
      Model.toolCache.delete(ev.playerId);
   };

   onPlayerBreakBlock = (ev) => {
      const player = ev.player;
      if (!player?.isValid) return;

      const action = Model.BLOCK_ACTION_MAP.get(ev.brokenBlockPermutation.type.id);
      if (!action) return;

      const tool = service.getCachedTool(player);
      if (!tool || !isValidTool(tool, action)) return;

      service.executeAction(player, ev.block.location, action, ev.block.dimension);
   };
}

export default new Controller();
