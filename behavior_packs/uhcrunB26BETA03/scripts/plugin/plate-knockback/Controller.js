import { KB, applyKnockbackXZ, normalizeXZ } from '../../shared/Util.js';
import model from './Model.js';
import service from './Service.js';

class Controller {
   // กระแทกผู้เล่นเมื่อเหยียบ pressure plate
   onPressurePlatePush = ({ block, source: player }) => {
      if (!model.PLATE_TYPES.has(block.typeId)) return;
      if (!player?.isValid) return;

      const dir = player.getViewDirection();
      const { nx, nz } = normalizeXZ(dir.x, dir.z);
      applyKnockbackXZ(player, nx, nz, model.PLATE.horizontal, model.PLATE.vertical, KB.maxHorizontal);
      block.dimension.playSound(service.nextSound(), player.location);
   };
}

export default new Controller();
