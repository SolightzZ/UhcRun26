import model from './Model.js';
import service from './Service.js';

class Controller {
   onPlayerPlaceBlock = ({ block, player }) => {
      if (block?.typeId !== model.TNT) return;
      service.placeTnt(block, player);
   };

   onPlayerLeave = ({ playerId }) => {
      model.cdMap.delete(playerId);
   };
}

export default new Controller();
