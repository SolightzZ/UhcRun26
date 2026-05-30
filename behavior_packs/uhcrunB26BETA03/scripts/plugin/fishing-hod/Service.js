import model from './Model.js';

class Service {
    isValidPvP = (a, b) => a?.isValid && b?.isValid && a.typeId === model.PLAYER_ID && b.typeId === model.PLAYER_ID && a.id !== b.id;

    applyKnockback = (target, source) => {
        if (!this.isValidPvP(target, source)) return;
        const dir = source.getViewDirection();
        const len = Math.hypot(dir.x, dir.z) || 1;

        target.applyKnockback({ x: (dir.x / len) * model.KB_H, z: (dir.z / len) * model.KB_H }, model.KB_V);
    };
}

export default new Service();
