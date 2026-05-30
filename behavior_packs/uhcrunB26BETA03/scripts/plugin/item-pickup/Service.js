import { ItemStack, system } from '@minecraft/server';
import model from './Model.js';

class Service {
    getContainer = (player) => {
        return player.getComponent('minecraft:inventory')?.container ?? null;
    };

    findEntry = (playerId) => {
        for (let i = 0; i < model.pendingList.length; i++) {
            if (model.pendingList[i].id === playerId) return model.pendingList[i];
        }
        return null;
    };

    smeltSlots = (player, slots) => {
        if (!player?.isValid) return;
        const container = this.getContainer(player);
        if (!container) return;

        for (const slot of slots) {
            const item = container.getItem(slot);
            if (!item) continue;

            const result = model.SMELT[item.typeId];
            if (!result) continue;

            const amount = item.amount;
            container.setItem(slot, undefined);

            const leftover = container.addItem(new ItemStack(result, amount));
            if (leftover) player.dimension.spawnItem(leftover, player.location);

            player.addExperience(amount * 2);
        }
    };

    scheduleFlushed = () => {
        if (model.flushScheduled) return;
        model.flushScheduled = true;

        system.run(() => {
            model.flushScheduled = false;
            const entries = model.pendingList.splice(0);
            for (const entry of entries) this.smeltSlots(entry.player, entry.slots);
        });
    };

    onPickup = (ev) => {
        const player = ev.entity;
        if (!player?.isValid || player.typeId !== 'minecraft:player') return;

        const pickedTypeId = ev.itemStack?.typeId;
        if (!pickedTypeId || !model.SMELT_TYPES.has(pickedTypeId)) return;

        const container = this.getContainer(player);
        if (!container) return;

        let entry = this.findEntry(player.id);

        if (!entry) {
            if (model.pendingList.length >= model.PENDING_MAX) {
                console.warn('[ItemPickup] queue full, dropping oldest entry');
                model.pendingList.shift();
            }

            entry = { id: player.id, player, slots: new Set() };
            model.pendingList.push(entry);
        }

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item?.typeId === pickedTypeId) {
                entry.slots.add(i);
                break;
            }
        }

        this.scheduleFlushed();
    };
}

export default new Service();
