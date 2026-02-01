import { world, system, ItemStack, EntityInventoryComponent } from "@minecraft/server";

const LIMIT = {
  MAX_DEPTH: 8,
  MAX_BLOCKS: 55,
  BATCH: 4,
  MAX_DISTANCE: 8,
  COOLDOWN: 40,
};

const BLOCK = {
  LOG: new Set([
    "minecraft:acacia_log",
    "minecraft:birch_log",
    "minecraft:cherry_log",
    "minecraft:dark_oak_log",
    "minecraft:jungle_log",
    "minecraft:mangrove_log",
    "minecraft:oak_log",
    "minecraft:spruce_log",
    "minecraft:crimson_stem",
    "minecraft:warped_stem",
    "minecraft:pale_oak_log",
  ]),
  LEAF: new Set([
    "minecraft:acacia_leaves",
    "minecraft:birch_leaves",
    "minecraft:cherry_leaves",
    "minecraft:dark_oak_leaves",
    "minecraft:jungle_leaves",
    "minecraft:mangrove_leaves",
    "minecraft:oak_leaves",
    "minecraft:spruce_leaves",
  ]),
};

const TOOL = new Set(["minecraft:wooden_axe", "minecraft:stone_axe", "minecraft:iron_axe", "minecraft:golden_axe", "minecraft:diamond_axe"]);

const DIR = [
  { x: 1, y: 0, z: 0 },
  { x: -1, y: 0, z: 0 },
  { x: 0, y: 1, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 0, z: -1 },
];

const activePlayers = new Set();

const isLog = (id) => BLOCK.LOG.has(id);
const isLeaf = (id) => BLOCK.LEAF.has(id);
const isTarget = (id) => isLog(id) || isLeaf(id);

const posKey = (p) => `${p.x},${p.y},${p.z}`;

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + Math.abs(a.z - b.z);

const neighbors = (block) =>
  DIR.map((d) => ({
    x: block.location.x + d.x,
    y: block.location.y + d.y,
    z: block.location.z + d.z,
  }));

function createQueue() {
  let data = [];
  let head = 0;

  return {
    push(v) {
      data.push(v);
    },
    pop() {
      return head < data.length ? data[head++] : null;
    },
    isEmpty() {
      return head >= data.length;
    },
  };
}

function drop(block, player) {
  const id = block.typeId;

  if (isLog(id)) {
    const amount = Math.floor(Math.random() * 2) + 1;
    block.dimension.spawnItem(new ItemStack(id, amount), block.location);
  }

  if (isLeaf(id) && Math.random() < 0.035) {
    block.dimension.spawnItem(new ItemStack("minecraft:apple", 1), block.location);
    player.playSound("random.levelup", {
      volume: 0.5,
      pitch: 1.5,
    });
  }
}

function floodStep(state) {
  const { queue, seen, player, origin } = state;
  let processed = 0;

  while (!queue.isEmpty() && processed < LIMIT.BATCH && state.count < LIMIT.MAX_BLOCKS) {
    const node = queue.pop();
    if (!node) break;

    const { block, depth } = node;
    if (!block || depth > LIMIT.MAX_DEPTH) continue;

    if (manhattan(origin.location, block.location) > LIMIT.MAX_DISTANCE) continue;

    drop(block, player);
    block.setType("minecraft:air");
    state.count++;

    for (const pos of neighbors(block)) {
      const adj = block.dimension.getBlock(pos);
      if (!adj) continue;

      const key = posKey(adj.location);
      if (!seen.has(key) && isTarget(adj.typeId)) {
        seen.add(key);
        queue.push({ block: adj, depth: depth + 1 });
      }
    }

    processed++;
  }

  if (!queue.isEmpty() && state.count < LIMIT.MAX_BLOCKS) {
    system.run(() => floodStep(state));
  } else {
    activePlayers.delete(player.id);
  }
}

function startFlood(player, block) {
  const queue = createQueue();
  const seen = new Set();

  queue.push({ block, depth: 0 });
  seen.add(posKey(block.location));

  const state = {
    player,
    origin: block,
    queue,
    seen,
    count: 0,
  };

  floodStep(state);
}

function getTool(player) {
  const inv = player.getComponent(EntityInventoryComponent.componentId);
  return inv?.container?.getItem(player.selectedSlotIndex);
}

function isValidBreak(event) {
  const { player, block } = event;
  const item = getTool(player);

  if (!item) return false;
  if (!TOOL.has(item.typeId)) return false;
  if (!isTarget(block.typeId)) return false;

  return true;
}

function onBreak(event) {
  const { player, block } = event;
  if (activePlayers.has(player.id)) return;
  if (!isValidBreak(event)) return;

  activePlayers.add(player.id);
  system.run(() => startFlood(player, block));

  system.runTimeout(() => {
    activePlayers.delete(player.id);
  }, LIMIT.COOLDOWN);
}

world.beforeEvents.playerBreakBlock.subscribe(onBreak);
