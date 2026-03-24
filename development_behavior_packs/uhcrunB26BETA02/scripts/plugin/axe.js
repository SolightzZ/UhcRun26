import { world, system, ItemStack, EntityInventoryComponent, ItemComponentTypes } from "@minecraft/server";

const CONFIG = Object.freeze({
  MAX_LOGS: 16,
  MAX_LEAVES: 57,
  CANOPY_RADIUS: 3,
  LEAF_SCAN_PAD: 4,

  APPLE_CHANCE: 0.035,

  COOLDOWN_TICKS: 5,
  SCAN_BLOCK_CAP: 550,
  BREAK_PER_TICK: 3,
  MAX_CONCURRENT_JOBS: 4,
});

const WOOD_MAP = Object.freeze({
  "minecraft:oak_log": "minecraft:oak_leaves",
  "minecraft:birch_log": "minecraft:birch_leaves",
  "minecraft:spruce_log": "minecraft:spruce_leaves",
  "minecraft:jungle_log": "minecraft:jungle_leaves",
  "minecraft:acacia_log": "minecraft:acacia_leaves",
  "minecraft:dark_oak_log": "minecraft:dark_oak_leaves",
  "minecraft:mangrove_log": "minecraft:mangrove_leaves",
  "minecraft:cherry_log": "minecraft:cherry_leaves",
  "minecraft:pale_oak_log": "minecraft:pale_oak_leaves",
});

const LOG_SET = new Set(Object.keys(WOOD_MAP));

const AXE_SET = new Set([
  "minecraft:wooden_axe",
  "minecraft:stone_axe",
  "minecraft:iron_axe",
  "minecraft:golden_axe",
  "minecraft:diamond_axe",
  "minecraft:netherite_axe",
]);

// ---------------------------
// สถานะขณะรัน (Runtime State)
// ---------------------------
const lastFellTick = new Map();

const jobQueue = [];
let activeJobs = 0;

// ---------------------------
// Utilities ฟังก์ชันช่วยทั่วไป
// ---------------------------
const posKey = (x, y, z) => `${x}|${y}|${z}`;

// ---------------------------
// Cooldown ตรวจสอบคูลดาวน์ของผู้เล่น
// ---------------------------
function checkCooldown(playerId) {
  const now = system.currentTick;
  const last = lastFellTick.get(playerId) ?? -CONFIG.COOLDOWN_TICKS;
  if (now - last < CONFIG.COOLDOWN_TICKS) return false;
  lastFellTick.set(playerId, now);
  return true;
}

// ---------------------------
// Player / Tool จัดการไอเทมในมือและความทนทาน
// ---------------------------
function getHeldItem(player) {
  const inv = player.getComponent(EntityInventoryComponent.componentId);
  return inv?.container?.getItem(player.selectedSlotIndex);
}

function applyToolDamage(player, amount) {
  const inv = player.getComponent(EntityInventoryComponent.componentId);
  const container = inv?.container;
  if (!container) return false;

  const slot = player.selectedSlotIndex;
  const item = container.getItem(slot);
  if (!item) return false;

  const dur = item.getComponent(ItemComponentTypes.Durability);
  if (!dur) return true;

  dur.damage = Math.min(dur.damage + amount, dur.maxDurability);
  if (dur.damage >= dur.maxDurability) {
    container.setItem(slot, undefined);
    player.playSound("random.break", { location: player.location, volume: 1.0, pitch: 0.9 });
    return false;
  }

  container.setItem(slot, item);
  return true;
}

// ---------------------------
// Object Pools สำหรับลด memory allocation
// ---------------------------
const logsPoolBelow = [];
const logsPoolAbove = [];
const allLogsPool = [];
const leavesPool = [];
const seenSet = new Set();
const blockLocPool = { x: 0, y: 0, z: 0 };

// ---------------------------
// Trunk ค้นหาแกนลำต้นแบบคอลัมน์ตรง
// ---------------------------
// เดินลงจาก brokenY-1 ในคอลัมน์ X,Z เดิม
function findTrunkBelow(dim, x, brokenY, z, logType) {
  // Reuse array
  logsPoolBelow.length = 0;

  for (let y = brokenY - 1; logsPoolBelow.length < CONFIG.MAX_LOGS; y--) {
    blockLocPool.x = x;
    blockLocPool.y = y;
    blockLocPool.z = z;

    const b = dim.getBlock(blockLocPool);
    if (!b || b.typeId !== logType) break;

    // เก็บ snapshot ทันที เพราะ Block proxy จะใช้ไม่ได้เมื่อข้ามหลาย tick
    logsPoolBelow.push({ loc: { x: b.location.x, y: b.location.y, z: b.location.z }, typeId: b.typeId });
  }
  return logsPoolBelow;
}

// เดินขึ้นจาก brokenY+1 ในคอลัมน์ X,Z เดิม
function findTrunkAbove(dim, x, brokenY, z, logType) {
  // Reuse array
  logsPoolAbove.length = 0;

  for (let y = brokenY + 1; logsPoolAbove.length < CONFIG.MAX_LOGS; y++) {
    blockLocPool.x = x;
    blockLocPool.y = y;
    blockLocPool.z = z;

    const b = dim.getBlock(blockLocPool);
    if (!b || b.typeId !== logType) break;

    // เก็บ snapshot ทันที เพราะ Block proxy จะใช้ไม่ได้เมื่อข้ามหลาย tick
    logsPoolAbove.push({ loc: { x: b.location.x, y: b.location.y, z: b.location.z }, typeId: b.typeId });
  }
  return logsPoolAbove;
}

// ---------------------------
// single-pass leaf scan สแกนใบไม้รอบลำต้นเพียงรอบเดียว
// ---------------------------
function scanLeaves(dim, x, baseY, topY, z, leafType) {
  // Reuse arrays and Set
  leavesPool.length = 0;
  seenSet.clear();

  const r = CONFIG.CANOPY_RADIUS;
  let blockCalls = 0;
  let hasLeaves = false;

  outer: for (let ly = baseY - 1; ly <= topY + CONFIG.LEAF_SCAN_PAD; ly++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (leavesPool.length >= CONFIG.MAX_LEAVES) break outer;
        if (blockCalls >= CONFIG.SCAN_BLOCK_CAP) break outer;

        const lx = x + dx;
        const lz = z + dz;
        const key = posKey(lx, ly, lz);
        if (seenSet.has(key)) continue;
        seenSet.add(key);

        blockLocPool.x = lx;
        blockLocPool.y = ly;
        blockLocPool.z = lz;

        const b = dim.getBlock(blockLocPool);
        blockCalls++;

        if (b?.typeId === leafType) {
          hasLeaves = true;
          // เก็บตำแหน่งทันที เพราะ Block proxy จะใช้ไม่ได้หลังจาก yield ไป tick อื่น
          leavesPool.push({ loc: { x: b.location.x, y: b.location.y, z: b.location.z }, typeId: b.typeId });
        }
      }
    }
  }

  return { hasLeaves, leaves: leavesPool };
}

// ---------------------------
// Deferred Breaking (runJob) กระจายการทำลายบล็อกหลาย tick
// ---------------------------
function* breakTreeJob(player, dim, logs, leaves) {
  let brokenLogs = 0;
  let brokenLeaves = 0;

  // รอบที่ 1: ทำลายบล็อกลำต้น (logs)
  let batchCount = 0;
  const logsLen = logs.length;

  for (let i = 0; i < logsLen; i++) {
    const { loc, typeId: id } = logs[i];
    const live = dim.getBlock(loc);
    if (live?.typeId === id) {
      live.setType("minecraft:air");
      dim.spawnItem(new ItemStack(id, 1), loc);
      brokenLogs++;
    }

    if (++batchCount >= CONFIG.BREAK_PER_TICK) {
      batchCount = 0;
      yield;
    }
  }

  // รอบที่ 2: ทำลายบล็อกใบไม้ (leaves)
  batchCount = 0;
  const leavesLen = leaves.length;

  for (let i = 0; i < leavesLen; i++) {
    const { loc, typeId: leafId } = leaves[i];
    const live = dim.getBlock(loc);
    if (live?.typeId === leafId) {
      live.setType("minecraft:air");
      brokenLeaves++;

      if (Math.random() < CONFIG.APPLE_CHANCE) {
        dim.spawnItem(new ItemStack("minecraft:apple", 1), loc);
        player.playSound("random.orb", { location: player.location, volume: 0.6, pitch: 1.2 });
      }
    }

    if (++batchCount >= CONFIG.BREAK_PER_TICK) {
      batchCount = 0;
      yield;
    }
  }

  // ความเสียหายของเครื่องมือ — เรียก setItem ครั้งเดียวสำหรับทั้งต้นไม้
  // นับ logs เต็มจำนวน แต่นับ leaves แค่ครึ่งหนึ่ง
  const totalDamage = brokenLogs + Math.ceil(brokenLeaves * 0.5);
  if (totalDamage > 0) applyToolDamage(player, totalDamage);

  // เล่นเสียงเฉพาะให้ผู้เล่นคนนี้เมื่อโค่นต้นไม้เสร็จทั้งต้น
  if (player.isValid) {
    player.playSound("dig.grass", { location: player.location, volume: 0.4, pitch: 0.9 });
  }
}

// ---------------------------
// Job Scheduler จัดคิวและจำกัดจำนวนงาน breakTreeJob
// ---------------------------
function startTreeJob(player, dim, logs, leaves) {
  activeJobs++;

  // wrapper generator เพื่อให้รู้เมื่อ job จบ แล้วลด activeJobs ลง
  const job = (function* () {
    try {
      yield* breakTreeJob(player, dim, logs, leaves);
    } finally {
      activeJobs--;
      scheduleJobs();
    }
  })();
  system.runJob(job);
}

function scheduleJobs() {
  while (activeJobs < CONFIG.MAX_CONCURRENT_JOBS && jobQueue.length > 0) {
    const { player, dim, logs, leaves } = jobQueue.shift();
    startTreeJob(player, dim, logs, leaves);
  }
}

function enqueueTreeJob(player, dim, logs, leaves) {
  jobQueue.push({ player, dim, logs, leaves });
  scheduleJobs();
}

// ---------------------------
// Event Handler จัดการเหตุการณ์ playerBreakBlock
// ---------------------------
function onPlayerBreakBlock(ev) {
  const player = ev.player;
  if (!player?.isValid) return;

  // 1. ตรวจว่าในมือเป็นขวานหรือไม่
  const heldItem = getHeldItem(player);
  if (!heldItem || !AXE_SET.has(heldItem.typeId)) return;

  // 2. ตรวจว่าบล็อกที่ถูกทุบเป็นลำต้นไม้ชนิดที่รองรับหรือไม่
  const logType = ev.brokenBlockPermutation.type.id;
  if (!LOG_SET.has(logType)) return;

  // 3. ตรวจคูลดาวน์ต่อผู้เล่น
  if (!checkCooldown(player.id)) {
    return;
  }

  const dim = player.dimension;
  const { x, y: brokenY, z } = ev.block.location;
  const leafType = WOOD_MAP[logType];

  // 4. สแกนลำต้น (Trunk scan) ความซับซ้อน O(H)
  const below = findTrunkBelow(dim, x, brokenY, z, logType);
  const above = findTrunkAbove(dim, x, brokenY, z, logType);

  // Reuse allLogsPool instead of creating new array
  allLogsPool.length = 0;
  for (let i = 0; i < above.length; i++) {
    allLogsPool.push(above[i]);
  }
  for (let i = 0; i < below.length; i++) {
    allLogsPool.push(below[i]);
  }

  const baseY = below.length ? below[below.length - 1].loc.y : brokenY;
  const topY = above.length ? above[above.length - 1].loc.y : brokenY;

  // 5. สแกนใบไม้รอบลำต้นแบบ single-pass (O(H×R²)
  const { hasLeaves, leaves } = scanLeaves(dim, x, baseY, topY, z, leafType);

  if (!hasLeaves) {
    return;
  }

  // 6. กระจายการทำลายบล็อกไปหลาย tick ผ่านคิวงาน (job queue) และ runJob
  enqueueTreeJob(player, dim, allLogsPool, leaves);
}

world.afterEvents.playerBreakBlock.subscribe(onPlayerBreakBlock);
