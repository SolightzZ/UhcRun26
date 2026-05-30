import model from './Model.js';

class Service {
    nextSound = () => {
        const sound = model.SOUNDS[model.soundIdx];
        model.soundIdx = (model.soundIdx + 1) % model.SOUNDS.length;
        return sound;
    };
}

export default new Service();
