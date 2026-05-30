import model from './Model.js';

class Service {
    isCookedFood = (itemId) => {
        if (!itemId) return false;
        return model.items.includes(itemId);
    };

    applyCookedEffect = (player) => {
        player.addEffect('regeneration', 200, {
            amplifier: 1,
            showParticles: false,
        });
    };

    handleConsume = (player, item) => {
        if (!player || !item) return;

        const itemId = item.typeId;

        if (!this.isCookedFood(itemId)) return;

        this.applyCookedEffect(player);
    };
}

export default new Service();
