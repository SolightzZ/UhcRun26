import service from './Service.js';

class Controller {
    onEntityItemPickup = (ev) => {
        service.onPickup(ev);
    };
}

export default new Controller();
