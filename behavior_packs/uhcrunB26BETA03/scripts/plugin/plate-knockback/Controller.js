import { KB, clamp } from '../Util.js';
import model from './Model.js';
import service from './Service.js';

class Controller {
    onPressurePlatePush = ({ block, source: player }) => {
        if (!model.PLATE_TYPES.has(block.typeId)) return;
        if (!player?.isValid) return;

        const dir = player.getViewDirection();
        const len = Math.hypot(dir.x, dir.z) || 1;
        const nx = dir.x / len;
        const nz = dir.z / len;

        player.applyKnockback({ x: clamp(nx * model.PLATE.horizontal, KB.maxHorizontal), z: clamp(nz * model.PLATE.horizontal, KB.maxHorizontal) }, model.PLATE.vertical);
        block.dimension.playSound(service.nextSound(), player.location);
    };
}

export default new Controller();
