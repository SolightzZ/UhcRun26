import { world } from '@minecraft/server';
import { renderBoard, spawnLeaderboardNPC, updateLeaderboard } from './LeaderboardNPC.js';

export { renderBoard, spawnLeaderboardNPC, updateLeaderboard };

world.beforeEvents.playerInteractWithEntity.subscribe((eventData) => {
    const { target } = eventData;
    if (target.typeId === 'minecraft:npc') {
        eventData.cancel = true;
    }
});
