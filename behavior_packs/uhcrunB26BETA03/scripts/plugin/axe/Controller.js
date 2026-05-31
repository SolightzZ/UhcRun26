import { system } from '@minecraft/server';
import model from './Model.js';
import service from './Service.js';

class Controller {
    register = () => {
        system.run(() => {
            model.getAir();
        });
    };

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
