import model from './Model.js';
import service from './Service.js';

class Controller {
   // เมื่อผู้เล่นวาง TNT ให้เรียก placeTnt
   onPlayerPlaceBlock = ({ block, player }) => {
      if (block?.typeId !== model.TNT) return;
      service.placeTnt(block, player);
   };

   // ล้าง cooldown เมื่อผู้เล่นออก
   onPlayerLeave = ({ playerId }) => {
      model.cdMap.delete(playerId);
   };
}

export default new Controller();
