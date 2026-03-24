import { world, system } from "@minecraft/server";

const MAX_CPS = 18;
const WINDOW_TICKS = 20;
const state = new Map();

// Object pooling for player data
const dataPool = [];
let poolIndex = 0;

function getOrCreateData(tick) {
  let data = dataPool[poolIndex];
  if (!data) {
    data = { start: tick, hits: 1 };
    dataPool[poolIndex] = data;
  } else {
    data.start = tick;
    data.hits = 1;
  }
  poolIndex = (poolIndex + 1) % 100;
  return data;
}

world.afterEvents.entityHitEntity.subscribe((e) => {
  const plr = e.damagingEntity;

  // Early returns
  if (!plr) return;
  if (plr.typeId !== "minecraft:player") return;

  const tick = system.currentTick;
  const id = plr.id;
  let data = state.get(id);

  // New player - use object pool
  if (!data) {
    state.set(id, getOrCreateData(tick));
    return;
  }

  // Reset window if expired
  if (tick - data.start >= WINDOW_TICKS) {
    data.start = tick;
    data.hits = 1;
    return;
  }

  // Check CPS violation
  data.hits++;
  if (data.hits > MAX_CPS) {
    const name = plr.name;
    console.warn(`[CPS] ${name} kicked: ${data.hits}/${MAX_CPS}`);

    // Single command instead of sendMessage + kick
    plr.runCommand(`kick "${name}" \nUHCRun\n§c[CPS] ${name} ${data.hits}/${MAX_CPS} (Auto-cheat)`);

    data.hits = 0;
  }
});
