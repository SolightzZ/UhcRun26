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

    // Called next tick: scan full inventory for any raw types queued for this player.
    smeltPlayer = (entry) => {
        const { player, types } = entry;
        if (!player?.isValid) return;
        const container = this.getContainer(player);
        if (!container) return;

        let smeltedAny = false;
        let totalIngots = 0;

        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item) continue;
            if (!types.has(item.typeId)) continue;

            const result = model.SMELT[item.typeId];
            if (!result) continue;

            const amount = item.amount;
            container.setItem(i, undefined);

            const leftover = container.addItem(new ItemStack(result, amount));
            if (leftover) player.dimension.spawnItem(leftover, player.location);

            player.addExperience(amount * 2);
            smeltedAny = true;
            totalIngots += amount;
        }

        if (smeltedAny) {
            player.playSound('random.orb', { location: player.location, volume: 0.5, pitch: 1.2 });
            player.onScreenDisplay.setActionBar(`§6Auto-Smelted: +${totalIngots} Ingots (Pickup)`);
        }
    };

    scheduleFlushed = () => {
        if (model.flushScheduled) return;
        model.flushScheduled = true;

        system.run(() => {
            model.flushScheduled = false;
            const entries = model.pendingList.splice(0);
            for (const entry of entries) this.smeltPlayer(entry);
        });
    };

    onPickup = (ev) => {
        const player = ev.entity;
        if (!player?.isValid || player.typeId !== 'minecraft:player') return;

        // Bedrock's native runtime returns a non-standard collection — use Array.from() to ensure iterability
        const items = Array.from(ev.items ?? []);
        if (!items.length) return;

        let hasSmeltable = false;
        for (const itemStack of items) {
            if (model.SMELT_TYPES.has(itemStack.typeId)) {
                hasSmeltable = true;
                break;
            }
        }
        if (!hasSmeltable) return;

        let entry = this.findEntry(player.id);
        if (!entry) {
            if (model.pendingList.length >= model.PENDING_MAX) {
                console.warn('[ItemPickup] queue full, dropping oldest entry');
                model.pendingList.shift();
            }
            // Store typeIds picked this tick — NOT slots (inventory not updated yet at pickup time)
            entry = { id: player.id, player, types: new Set() };
            model.pendingList.push(entry);
        }

        for (const itemStack of items) {
            if (model.SMELT_TYPES.has(itemStack.typeId)) {
                entry.types.add(itemStack.typeId);
            }
        }
        this.scheduleFlushed();
    };
}

export default new Service();
