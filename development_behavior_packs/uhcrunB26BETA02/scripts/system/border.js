// ========= สเปคคนทำแอดออน ========================
// i5-13420H  / RAM 32 DDR5-5200 / SSD NVMe SAMSUNG 512 / NVIDIA GeForce RTX 4050 Laptop GPU

// ========= ขอบเขตรองรับผุ้เล่น ========================
// 1–30 คน แต่เป็นกลุ่มเดียวกัน เพราะจะได้เล่นทีม
// ทีม solo (30 player) Solo
// เช่นทีม 2 (30 player) Dolo
// เช่นทีม 3 (30 player)
// เช่นทีม 4 (30 player)
// เช่นทีม 5 (30 player)

import {
  world,
  system,
  DisplaySlotId,
  GameMode,
  ItemStack,
  InputPermissionCategory,
  MolangVariableMap,
  EquipmentSlot,
  BlockPermutation,
  EntityDamageCause,
} from "@minecraft/server";
import {
  getPlayerTeam,
  getTeams,
  getTeamInfo,
  getAllPlayers,
  getUhcPlayers,
  refreshPlayerCaches,
  clearAllTeams,
  clearAllTaguhcAndDynamicProperty,
  resetAnnouncerSystem,
  setGameRunningState,
  refreshScoreboardUI,
  isPlayerUhcId,
  clearAllPlayerNametags,
} from "../Manager/TeamManager.js";

import { dynamicToast } from "../plugin/Util.js";
import { spawnLeaderboardNPC } from "../Manager/Leaderboard.js";

// ============================================================
//  Block Fill System
// ============================================================

const WORLD_MIN_Y = -64,
  WORLD_MAX_Y = 319,
  BATCH_SIZE = 200,
  POS = { x: 0, y: 0, z: 0 },
  BLOCK_CATEGORIES = {
    ore: [
      "minecraft:coal_ore",
      "minecraft:iron_ore",
      "minecraft:copper_ore",
      "minecraft:gold_ore",
      "minecraft:redstone_ore",
      "minecraft:lapis_ore",
      "minecraft:diamond_ore",
      "minecraft:emerald_ore",
    ],
    nether: ["minecraft:ancient_debris", "minecraft:magma", "minecraft:blackstone"],
    concrete: [
      "minecraft:white_concrete",
      "minecraft:orange_concrete",
      "minecraft:magenta_concrete",
      "minecraft:light_blue_concrete",
      "minecraft:yellow_concrete",
      "minecraft:lime_concrete",
      "minecraft:pink_concrete",
      "minecraft:gray_concrete",
      "minecraft:light_gray_concrete",
      "minecraft:cyan_concrete",
      "minecraft:purple_concrete",
      "minecraft:blue_concrete",
      "minecraft:brown_concrete",
      "minecraft:green_concrete",
      "minecraft:red_concrete",
      "minecraft:black_concrete",
    ],
    random: [
      "minecraft:obsidian",
      "minecraft:crying_obsidian",
      "minecraft:amethyst_block",
      "minecraft:calcite",
      "minecraft:deepslate",
      "minecraft:basalt",
    ],
  },
  MODE = Object.freeze({ CLEAR: 0, ORE: 1, NETHER: 2, CONCRETE: 3, RANDOM: 4 });

let AIR;

const CATEGORY_MAP = new Map([
  [MODE.ORE, BLOCK_CATEGORIES.ore],
  [MODE.NETHER, BLOCK_CATEGORIES.nether],
  [MODE.CONCRETE, BLOCK_CATEGORIES.concrete],
  [MODE.RANDOM, BLOCK_CATEGORIES.random],
]);

function initPermutations() {
  if (AIR) return;
  AIR = BlockPermutation.resolve("minecraft:air");

  const entries = Array.from(CATEGORY_MAP.entries()),
    eLen = entries.length;

  for (let i = 0; i < eLen; i++) {
    const [mode, blocks] = entries[i],
      arr = [],
      bLen = blocks.length;

    for (let j = 0; j < bLen; j++) {
      arr.push(BlockPermutation.resolve(blocks[j]));
    }
    CATEGORY_MAP.set(mode, arr);
  }
}

const randomBlock = (mode) => {
  const arr = CATEGORY_MAP.get(mode);
  if (!arr || arr.length === 0) return AIR;
  return arr[(Math.random() * arr.length) | 0];
};

// ใช้ circular buffer แทน array+splice เพื่อลด overhead
const TASK_QUEUE = [];
let queueHead = 0,
  fillIntervalId = null; // handle สำหรับ interval ของ fill system

function addTask(task) {
  TASK_QUEUE.push(task);
  if (fillIntervalId === null) {
    fillIntervalId = system.runInterval(processFillQueue, 2);
  }
}

function processFillQueue() {
  if (queueHead >= TASK_QUEUE.length) {
    TASK_QUEUE.length = 0;
    queueHead = 0;
    system.clearRun(fillIntervalId);
    fillIntervalId = null;
    return;
  }

  // หยุดเมื่อครบ BATCH_SIZE หรือ queue หมด
  let processed = 0;
  while (processed < BATCH_SIZE && queueHead < TASK_QUEUE.length) {
    if (TASK_QUEUE[queueHead]()) queueHead++;
    processed++;
  }

  if (queueHead > 2048) {
    const remaining = TASK_QUEUE.length - queueHead;
    for (let i = 0; i < remaining; i++) TASK_QUEUE[i] = TASK_QUEUE[queueHead + i];
    TASK_QUEUE.length = remaining;
    queueHead = 0;
  }
}

function setBlock(dim, x, y, z, mode) {
  POS.x = x;
  POS.y = y;
  POS.z = z;
  const block = dim.getBlock(POS);
  if (!block) return;
  if (mode === MODE.CLEAR) {
    if (!block.permutation.matches("minecraft:air")) block.setPermutation(AIR);
  } else {
    const perm = randomBlock(mode);
    if (!block.permutation.matches(perm.type.id)) block.setPermutation(perm);
  }
}

function createFillTask(dim, x1, y1, z1, x2, y2, z2, mode) {
  // รับ dim โดยตรงแทน player เพื่อป้องกัน crash ถ้า player ออก
  initPermutations();
  const minX = Math.min(x1, x2),
    maxX = Math.max(x1, x2),
    minZ = Math.min(z1, z2),
    maxZ = Math.max(z1, z2),
    minY = Math.max(WORLD_MIN_Y, Math.min(y1, y2)),
    maxY = Math.min(WORLD_MAX_Y, Math.max(y1, y2));

  let x = minX,
    y = minY,
    z = minZ;

  return () => {
    setBlock(dim, x, y, z, mode);
    if (++z > maxZ) {
      z = minZ;
      if (++x > maxX) {
        x = minX;
        y++;
      }
    }
    return y > maxY;
  };
}

function rotatePattern(pattern) {
  const out = [],
    len = pattern.length;

  for (let i = 0; i < len; i++) {
    const [x1, y1, z1, x2, y2, z2] = pattern[i];
    out.push([z1, y1, -x1, z2, y2, -x2]);
  }
  return out;
}

function buildRotationCache(pattern) {
  const r1 = rotatePattern(pattern),
    r2 = rotatePattern(r1),
    r3 = rotatePattern(r2);

  return [pattern, r1, r2, r3];
}

function runPatternLayeredRotate(player, rotationCache, mode, delay = 20) {
  if (!player?.isValid) return;
  const dim = player.dimension,
    baseY = Math.floor(player.location.y) - 1;
  let layer = 0,
    rot = 0;
  function runLayer() {
    if (!isRunning && mode !== MODE.CLEAR) return; // guard: หยุดถ้า game ไม่ได้รันอยู่แล้ว
    const y = baseY - layer;
    if (y < WORLD_MIN_Y) return;
    const ptn = rotationCache[rot],
      pLen = ptn.length;

    for (let i = 0; i < pLen; i++) {
      const p = ptn[i];
      addTask(createFillTask(dim, p[0], y, p[2], p[3], y, p[5], mode));
    }
    rot = (rot + 1) & 3;
    layer++;
    system.runTimeout(runLayer, delay);
  }
  runLayer();
}

function runPattern(player, pattern, mode) {
  if (!player?.isValid) return;
  const dim = player.dimension,
    playerY = Math.floor(player.location.y) - 1,
    len = pattern.length;

  for (let i = 0; i < len; i++) {
    const p = pattern[i];
    addTask(createFillTask(dim, p[0], p[1], p[2], p[3], playerY, p[5], mode));
  }
}

const PATTERN_1 = [
    [-8, -64, 9, 16, -1, 16],
    [9, -64, -16, 16, -1, 8],
    [-16, -64, -16, 8, -1, -9],
    [-16, -64, -8, -9, -1, 16],
  ],
  PATTERN_2 = [
    [-1, -64, -8, 8, -1, -2],
    [2, -64, -1, 8, -1, 8],
    [-8, -64, 2, 1, -1, 8],
    [-8, -64, -8, -2, -1, 1],
  ],
  PATTERN_3 = [
    [17, -64, 16, 17, -1, -17],
    [16, -64, -17, -17, -1, -17],
    [-17, -64, -16, -17, -1, 17],
    [-16, -64, 17, 17, -1, 17],
  ],
  ROT_CACHE_1 = buildRotationCache(PATTERN_1),
  ROT_CACHE_2 = buildRotationCache(PATTERN_2);

// PATTERN 1 = !c1 delay 1 tick
function runEndPattern1(player) {
  runPatternLayeredRotate(player, ROT_CACHE_1, MODE.CLEAR, 1);
}

// PATTERN 2 = !c2 delay 20 tick
function runEndPattern2(player) {
  runPatternLayeredRotate(player, ROT_CACHE_2, MODE.CLEAR, 20);
}

// PATTERN 3 = !g3
function runEndPattern3(player) {
  runPattern(player, PATTERN_3, MODE.NETHER);
}

// ============================================================
//  Constants & Configuration
// ============================================================

const icons = Object.freeze({
  Sword: "",
  Bow: "",
  shield: "",
  Helmet: "",
  Border: "",
  Mojang: "",
  Bot: "",
  Sailboat: "",
  FourGrid: "",
  Corners: "",
  Diagonal: "",
  Burst: "",
  Clock: "",
  Square: "",
  Bars: "",
  Frame: "",
  Hourglass: "",
});

const TEAMS = getTeams(),
  CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2],
  borderEnd = CHECKPOINTS[CHECKPOINTS.length - 1];

const BORDER_RENDER = Object.freeze({
  RENDER_MASK: 3,
  VIEW_DISTANCE: 35,
  PARTICLE_Y: 100,
});

const borderColors = {
  blue: { red: 0, green: 0.54, blue: 1, alpha: 1.0 },
  red: { red: 1.0, green: 0.2, blue: 0.2, alpha: 1.0 },
};

const titleConfig = Object.freeze({ stayDuration: 200, fadeInDuration: 10, fadeOutDuration: 20 }),
  soundConfig = Object.freeze({ volume: 0.8, pitch: 1 }),
  configDamage = { cause: EntityDamageCause.void };

const worldborder_ew = "worldborder:worldborder_ew",
  worldborder = "worldborder:worldborder",
  uhc = "uhc",
  uhcName = "§h§nUhcRun26",
  ticks = 20,
  center = { x: 0, z: 0 },
  FIRST_SHRINK_DELAY = 300; // ticks ก่อนวงบีบครั้งแรก

// ============================================================
//  Runtime State
// ============================================================

// Game state
let isRunning = false,
  uhcTick = 0,
  checkInterval = null;

// Border state
let borderReady = false,
  borderRadius = CHECKPOINTS[0],
  nextShrinkIndex = 1,
  nextShrinkTick = FIRST_SHRINK_DELAY,
  targetRadius = null;

// Render state
let currentBorderColor = borderColors.blue,
  borderMolang = null;

// Caches
let cachedDimension = null, // เก็บ Dimension (อิงตามผู้เล่นคนแรก)
  objective = null, // เก็บ Object Scoreboard ที่อ้างอิงถึง
  aliveTeamBarCache = "§7-", // Cache ของหลอดแสดงสถานะทีมที่ยังมีชีวิตเพื่อโชว์ใน Scoreboard
  aliveTeamDirty = true; // Flag บอกว่ามีการตาย/ออก จนต้องอัปเดตทีมบาร์ใหม่มั้ย

// Lookup maps
const scoreCache = new Map(), // { lineIndex (0-4) -> text (string) } ไว้เทียบข้อความเก่าใน Scoreboard จะได้ไม่อัปเดตซ้ำถ้าค่าเดิมเป๊ะ
  TeamIndexMap = new Map(TEAMS.map((t, i) => [t.id, i])), // { "team1" -> 0, "team2" -> 1 } เก็บ index หาลำดับของทีมไวๆ
  groupMaps = new Map(); // { "cellX:cellZ" (รหัสคีย์) -> { cellX: number, cellZ: number, rep: Player } } เซ็ตตัวแทนจุดกึ่งกลางของคนที่เกาะกลุ่มกันเพื่อวาด particle ให้ครั้งเดียว

// Reusable objects
const reusableTitleOptions = {
  stayDuration: titleConfig.stayDuration,
  fadeInDuration: titleConfig.fadeInDuration,
  fadeOutDuration: titleConfig.fadeOutDuration,
  subtitle: "",
};

// ============================================================
//  Scoreboard
// ============================================================

function Objectives() {
  const score = world.scoreboard;

  const old = score.getObjective(uhc);
  if (old) score.removeObjective(old);

  const obj = score.addObjective(uhc, uhcName);
  score.setObjectiveAtDisplaySlot(DisplaySlotId.Sidebar, { objective: obj });

  objective = obj;
  scoreCache.clear();
}

function clearScoreboard() {
  const sb = world.scoreboard;
  sb.clearObjectiveAtDisplaySlot(DisplaySlotId.Sidebar);
  const obj = sb.getObjective(uhc);
  if (obj) sb.removeObjective(obj);
  scoreCache.clear();
  objective = null;
}

// อัปเดตเฉพาะ line ที่เปลี่ยนแปลง ลด scoreboard call
function updateScoreLine(objective, index, text) {
  const old = scoreCache.get(index);
  if (old === text) return;
  if (old) objective.removeParticipant(old);
  objective.setScore(text, 10 - index);
  scoreCache.set(index, text);
}

function getFillProgress() {
  if (fillIntervalId === null) return "§cFINAL";
  const total = TASK_QUEUE.length;
  if (!total) return "§cFINAL";
  const done = queueHead,
    remain = total - done;

  return `§6${icons.Clock} §f${done}§7/${total} §8(${remain})`;
}

function computeNextLabel() {
  if (targetRadius != null) {
    const remain = Math.max(0, shrinkDuration - (uhcTick - shrinkStartTick));
    return remain > 0 ? remain + "s" : getFillProgress();
  }
  if (nextShrinkIndex >= CHECKPOINTS.length) return getFillProgress();
  const remain = nextShrinkTick - uhcTick;
  return remain > 0 ? remain + "s" : "§9NOW";
}

let lastBorderRadius = -1,
  lastPlayerCount = -1,
  lastTargetRadius = null;

function updateScore(objective, uhcPlayers) {
  const c = targetRadius !== null ? "§c" : "§f",
    pCount = uhcPlayers.length;

  // line 0: border — update เฉพาะตอน borderRadius หรือ targetRadius เปลี่ยน
  if (borderRadius !== lastBorderRadius || targetRadius !== lastTargetRadius) {
    updateScoreLine(objective, 0, `${c}${icons.Border} ${borderRadius}§7/${computeNextBorder()}`);
    lastBorderRadius = borderRadius;
    lastTargetRadius = targetRadius;
  }

  // line 1: label — update ทุก tick เพราะมี countdown fill progress
  updateScoreLine(objective, 1, `${c}${computeNextLabel()}`);

  // line 2: player count — update เฉพาะตอนจำนวนเปลี่ยน
  if (pCount !== lastPlayerCount) {
    updateScoreLine(objective, 2, `${c}${icons.Bot} §f${pCount}`);
    lastPlayerCount = pCount;
  }

  // line 3, 4: update ทุก tick เพราะ aliveTeamBar และ gameState เปลี่ยนบ่อย
  updateScoreLine(objective, 3, `${getAliveTeamBar(uhcPlayers)}`);
  updateScoreLine(objective, 4, `${getGameState()}`);
}

// ============================================================
//  Team Bar / Game State
// ============================================================

function rebuildAliveTeamBar(players) {
  const len = players.length;
  if (!len) {
    aliveTeamBarCache = "§7-";
    aliveTeamDirty = false;
    return;
  }

  let mask = 0;
  for (let i = 0; i < len; i++) {
    const p = players[i];
    if (!p) continue;
    const tag = getPlayerTeam(p);
    if (!tag) continue;
    const index = TeamIndexMap.get(tag);
    if (index !== undefined) mask |= 1 << index;
  }

  if (!mask) {
    aliveTeamBarCache = "§7-";
    aliveTeamDirty = false;
    return;
  }

  let bar = "";
  const teamsLen = TEAMS.length;
  for (let i = 0; i < teamsLen; i++) {
    if (mask & (1 << i)) bar += TEAMS[i].color + "▒";
  }
  aliveTeamBarCache = bar;
  aliveTeamDirty = false;
}

function getAliveTeamBar(players) {
  if (aliveTeamDirty) rebuildAliveTeamBar(players);
  return aliveTeamBarCache;
}

function getGameState() {
  if (!isRunning) return `${icons.Hourglass}`;
  if (uhcTick < 30) return `?`;
  if (!world.gameRules.pvp) return `${icons.shield}`;
  if (nextShrinkIndex < CHECKPOINTS.length) return `${icons.Sword}`;
  return `?`;
}

function computeNextBorder() {
  if (targetRadius != null) return targetRadius;
  if (nextShrinkIndex >= CHECKPOINTS.length) return borderEnd;
  return CHECKPOINTS[nextShrinkIndex];
}

// ============================================================
//  World Border — Geometry
// ============================================================

// เปลี่ยนแปลงขนาดวงแหวนปัจจุบัน
function setBorderRadius(r) {
  const clamped = Math.max(r, borderEnd);

  if (clamped === borderRadius && wbBounds) return;

  borderRadius = clamped;
  syncWorldBorderGeometry();
}

// ============================================================
//  World Border — Shrink State Machine
// ============================================================

function updateSmoothBorder() {
  if (targetRadius === null || shrinkDuration <= 0) return;

  const elapsed = uhcTick - shrinkStartTick,
    progress = Math.min(1, elapsed / shrinkDuration),
    newRadius = Math.round(startRadius + (targetRadius - startRadius) * progress);

  if (newRadius !== borderRadius) {
    borderRadius = newRadius;
    syncWorldBorderGeometry();
  }

  if (progress >= 1) {
    borderRadius = targetRadius;
    syncWorldBorderGeometry();
    targetRadius = null;
    currentBorderColor = borderColors.blue;
  }
}

// Lookup table: [minTarget, shrinkDuration, restTime]
const SHRINK_CONFIG = [
  [200, 80, 90],
  [100, 60, 60],
  [50, 50, 45],
  [16, 40, 30],
  [5, 30, 20],
  [0, 20, 15],
];

function lookupShrinkConfig(target) {
  for (let i = 0; i < SHRINK_CONFIG.length; i++) {
    if (target >= SHRINK_CONFIG[i][0]) return SHRINK_CONFIG[i];
  }
  return SHRINK_CONFIG[SHRINK_CONFIG.length - 1];
}

function getRestTime(target) {
  return lookupShrinkConfig(target)[2];
}

function getShrinkDuration(target) {
  return lookupShrinkConfig(target)[1];
}

let shrinkStartTick = 0,
  shrinkDuration = 0,
  startRadius = CHECKPOINTS[0];

// เริ่มต้นสั่งให้วงบีบไปที่เป้าหมาย Checkpoint ถัดไปแบบสมูท
function applyBorderShrink() {
  if (targetRadius !== null) return;

  const players = getUhcPlayers();
  if (!players.length) return;
  if (nextShrinkIndex >= CHECKPOINTS.length) return;

  const target = CHECKPOINTS[nextShrinkIndex];
  if (!Number.isFinite(target) || target >= borderRadius) return;

  targetRadius = target;
  startRadius = borderRadius;
  shrinkStartTick = uhcTick;
  shrinkDuration = getShrinkDuration(target);

  nextShrinkIndex++;
  currentBorderColor = borderColors.red;

  const restTime = getRestTime(target);
  nextShrinkTick = shrinkStartTick + shrinkDuration + restTime;

  broadcast(players, {
    message: dynamicToast(`วงกำลังบีบไปที่ §c${target}`, "textures/blocks/barrier"),
    sound: "world_noti",
  });
}

// ส่งข้อความเตือนผู้เล่นก่อนวงบีบ 30 วินาที
function broadcastBorderWarning() {
  const players = getUhcPlayers();
  if (!players.length) return;
  broadcast(players, {
    message: dynamicToast(`วงจะเริ่มบีบในอีก §c30 §fวินาที`, "textures/ui/ErrorGlyph_small_hover"),
    sound: "noti",
  });
}

// ทำงานทุก Tick คอยเช็คว่าถึงเวลาบีบวงหรือส่งคำเตือนหรือยัง
function eventBorders() {
  if (nextShrinkIndex >= CHECKPOINTS.length) {
    tickEndSequence();
    return;
  }

  if (uhcTick === nextShrinkTick - 30) broadcastBorderWarning();
  if (uhcTick >= nextShrinkTick) applyBorderShrink();
}

// ============================================================
//  End-Game Pattern Sequence (หลัง CHECKPOINTS ถึง 2)
// ============================================================

// 3 นาที = 180 ticks
const END_WAIT_TICKS = 180;

// state: 0=รอก่อน P3, 1=รอก่อน P1, 2=รอก่อน P2, 3=จบแล้ว
let endSeqState = 0,
  endSeqStartTick = -1;

function resetEndSequence() {
  endSeqState = 0;
  endSeqStartTick = -1;
}

// Table-driven end sequence: [nextState, message, icon, patternFn]
const END_SEQUENCE = [
  [1, "§6PATTERN 3 §fเริ่มแล้ว!", "textures/blocks/nether_brick", runEndPattern3],
  [2, "§cPATTERN 1 §fเริ่มแล้ว!", "textures/blocks/barrier", runEndPattern1],
  [3, "§aPATTERN 2 §fเริ่มแล้ว!", "textures/blocks/diamond_ore", runEndPattern2],
];

function tickEndSequence() {
  if (endSeqState === 3) return;
  if (targetRadius !== null) return;

  if (endSeqStartTick === -1) {
    endSeqStartTick = uhcTick;
    broadcast(getUhcPlayers(), {
      message: dynamicToast("วงถึงขีดสุดแล้ว! เตรียมตัว...", "textures/blocks/barrier"),
      sound: "world_noti",
    });
    return;
  }

  if (uhcTick - endSeqStartTick < END_WAIT_TICKS) return;

  const seq = END_SEQUENCE[endSeqState];
  if (!seq) return;

  const [nextState, msg, icon, patternFn] = seq;
  endSeqState = nextState;
  endSeqStartTick = nextState < 3 ? uhcTick : endSeqStartTick; // state 3 ไม่ต้อง reset tick

  const players = getUhcPlayers();
  broadcast(players, { message: dynamicToast(msg, icon), sound: "world_noti" });

  for (let i = 0; i < players.length; i++) patternFn(players[i]);
}

// ============================================================
//  World Border — Wall Detection & Rendering
// ============================================================

function getMolang(width = 8) {
  if (!borderMolang) borderMolang = new MolangVariableMap();
  borderMolang.setColorRGBA("variable.color", currentBorderColor);
  borderMolang.setFloat("variable.size", width);
  return borderMolang;
}

//  จัดกลุ่มคนเล่นที่อยู่โซนเดียวกันเพื่อวาดกำแพงด้วยกัน (หน้าม้า 1 คนต่อกลุ่ม)
// player ที่อยู่ cell เดียวกัน = 1 กลุ่ม = spawn particle ครั้งเดียว ทุกคนในกลุ่มเห็นพร้อมกัน
const CELL_SIZE = 16,
  CELL_OFFSET = 32, // รองรับ ±32 cells = ±512 blocks (ครอบ ±500)
  CELL_RANGE = 64; // CELL_OFFSET * 2

const groupsPool = []; // reuse array/object แทน new ทุก tick เพื่อลด GC
let groupsLen = 0;

function groupPlayersByCell(players) {
  groupMaps.clear();
  groupsLen = 0;

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p?.isValid) continue;

    const loc = p.location;
    if (!loc) continue;

    const cellX = (loc.x / CELL_SIZE) | 0;
    const cellZ = (loc.z / CELL_SIZE) | 0;
    const key = (cellX + CELL_OFFSET) * CELL_RANGE + (cellZ + CELL_OFFSET);

    if (!groupMaps.has(key)) {
      let group = groupsPool[groupsLen]; // reuse object จาก pool ถ้ามี ไม่งั้นสร้างใหม่ครั้งเดียว
      if (!group) {
        group = { cellX: 0, cellZ: 0, rep: null };
        groupsPool[groupsLen] = group;
      }
      group.cellX = cellX;
      group.cellZ = cellZ;
      group.rep = p;
      groupMaps.set(key, group);
      groupsLen++;
    }
  }
}

const sharedPos = { x: 0, y: BORDER_RENDER.PARTICLE_Y, z: 0 };

function safeSpawnParticle(dim, particleId, location, molang) {
  try {
    dim.spawnParticle(particleId, location, molang);
  } catch (_) {}
}

// spawnedThisTick — กัน spawn particle จุดเดิมซ้ำจาก 2 groups ที่อยู่ใกล้กัน
// particle เป็น world-space ทุกคนเห็นพร้อมกัน spawn ครั้งเดียวพอ
const spawnedThisTick = new Set();

function renderEdge(dim, fixed, rangeMin, rangeMax, playerCoord, view, step, axis, particleId, molang) {
  if (playerCoord < fixed - view || playerCoord > fixed + view) return;

  let value = rangeMin - (rangeMin % step);
  if (value < rangeMin) value += step;

  // fixed และ value อยู่ในช่วง ±500 → +500 = max 1000
  // key = axis * 1001 * 1001 + (fixed+500) * 1001 + (value+500)
  // ไม่ชนกันแน่นอนในช่วง ±500
  const fixedKey = (fixed + 500) * 1001,
    axisKey = axis * 1001 * 1001;

  for (; value <= rangeMax; value += step) {
    const key = axisKey + fixedKey + (value + 500);
    if (spawnedThisTick.has(key)) continue;
    spawnedThisTick.add(key);

    if (axis === 0) {
      sharedPos.x = fixed;
      sharedPos.z = value;
    } else {
      sharedPos.x = value;
      sharedPos.z = fixed;
    }
    safeSpawnParticle(dim, particleId, sharedPos, molang);
  }
}

function renderBorderAABB(dim, step, molang) {
  if (!dim || !groupsLen || !wbBounds) return;

  const [east, west, north, south] = wbBounds;
  const view = BORDER_RENDER.VIEW_DISTANCE;

  spawnedThisTick.clear(); // clear ครั้งเดียวต่อ tick ก่อนวาดทุก group

  for (let i = 0; i < groupsLen; i++) {
    const rep = groupsPool[i].rep;
    if (!rep?.isValid) continue;

    const loc = rep.location;
    if (!loc) continue;
    const px = loc.x,
      pz = loc.z;

    const minX = px - view,
      maxX = px + view,
      minZ = pz - view,
      maxZ = pz + view;

    if (px > east - view) renderEdge(dim, east, Math.max(north, minZ), Math.min(south, maxZ), px, view, step, 0, worldborder, molang);
    if (px < west + view) renderEdge(dim, west, Math.max(north, minZ), Math.min(south, maxZ), px, view, step, 0, worldborder, molang);
    if (pz < north + view) renderEdge(dim, north, Math.max(west, minX), Math.min(east, maxX), pz, view, step, 1, worldborder_ew, molang);
    if (pz > south - view) renderEdge(dim, south, Math.max(west, minX), Math.min(east, maxX), pz, view, step, 1, worldborder_ew, molang);
  }
}

// Reuse particle location objects
const particleLocPool = { x: 0, y: 0, z: 0 };

function renderSmallBorder(dim) {
  const n = borderRadius;
  const molang = getMolang(n);
  const ys = BORDER_RENDER.PARTICLE_Y;

  // Reuse location object
  particleLocPool.y = ys;

  particleLocPool.x = n;
  particleLocPool.z = 0;
  dim.spawnParticle(worldborder, particleLocPool, molang);

  particleLocPool.x = -n;
  dim.spawnParticle(worldborder, particleLocPool, molang);

  particleLocPool.x = 0;
  particleLocPool.z = n;
  dim.spawnParticle(worldborder_ew, particleLocPool, molang);

  particleLocPool.z = -n;
  dim.spawnParticle(worldborder_ew, particleLocPool, molang);
}

function BorderTick(players) {
  if (!isRunning || !borderReady || !wbBounds) return;

  // Check border damage less frequently (4 → 8 ticks)
  if (uhcTick % 8 === 0) {
    for (let i = 0; i < players.length; i++) {
      handleBorderDamage(players[i]);
    }
  }

  // Render border less frequently (4 → 8 ticks)
  if (uhcTick % 8 !== 0) return;

  groupPlayersByCell(players);
  if (!groupsLen) return;

  const firstRep = groupsPool[0].rep;
  if (!firstRep?.isValid) return;

  const dim = firstRep.dimension;
  if (!dim) return;

  if (borderRadius < 100) {
    renderSmallBorder(dim);
    return;
  }

  renderBorderAABB(dim, 16, getMolang(8));
}

// ============================================================
//  Main Tick Loop
// ============================================================

function WorldTick(uhcPlayers) {
  eventBorders();
  updateSmoothBorder();
  if (isRunning && uhcTick <= 380) handleWorldStart(uhcTick, uhcPlayers);

  // Update scoreboard less frequently (every tick → every 2 ticks)
  if (objective && uhcTick % 2 === 0) updateScore(objective, uhcPlayers);

  BorderTick(uhcPlayers);
  aliveTeamDirty = true;
}

const CRITICAL_TICKS = new Set([1, 2, 4, 24, 26]);

function PlayersTick(players) {
  const len = players.length;
  if (!len) return;

  // Early exit if past game start
  if (uhcTick > 26) return;

  const tick = uhcTick;

  // Only process on critical ticks
  const needsGameStartUpdate = CRITICAL_TICKS.has(tick);

  for (let i = 0; i < len; i++) {
    const p = players[i];
    if (!p?.isValid) continue;

    if (needsGameStartUpdate) handleGameStart(p, tick);
    displayGameStart(p);
  }
}

function runIntervals() {
  checkInterval = system.runInterval(() => {
    if (!isRunning) return;

    uhcTick++;

    if (uhcTick % 120 === 0) checkVictory();
    if (uhcTick % 10 === 0) refreshPlayerCaches();

    const uhcPlayers = getUhcPlayers();
    WorldTick(uhcPlayers);

    if (uhcTick <= 26) PlayersTick(getAllPlayers());
  }, ticks);
}

// ============================================================
//  Border Damage and Fog
// ============================================================

const BORDER_SAFE_ZONE = 5,
  BORDER_DAMAGE_PER_BLOCK = 0.2;

function handleBorderDamage(playeruhc) {
  if (!playeruhc?.isValid || !wbBounds) return;

  const loc = playeruhc.location;
  if (!loc) return;
  const { x, z } = loc;

  const dx = x > wbBounds[0] ? x - wbBounds[0] : x < wbBounds[1] ? wbBounds[1] - x : 0,
    dz = z > wbBounds[3] ? z - wbBounds[3] : z < wbBounds[2] ? wbBounds[2] - z : 0;

  const outside = Math.max(dx, dz),
    distanceOutside = outside - BORDER_SAFE_ZONE;

  if (distanceOutside <= 0) return;

  playeruhc.applyDamage(distanceOutside * BORDER_DAMAGE_PER_BLOCK, configDamage);
}

// ============================================================
//  Broadcast
// ============================================================

function broadcast(targetOrPayload, maybePayload) {
  let targets, payload;

  if (maybePayload !== undefined) {
    targets = targetOrPayload;
    payload = maybePayload;
  } else {
    targets = getAllPlayers();
    payload = targetOrPayload;
  }

  if (!payload || !targets?.length) return;

  const { message, title, subtitle, sound } = payload,
    hasMessage = typeof message === "string",
    hasTitle = typeof title === "string" || typeof subtitle === "string",
    hasSound = typeof sound === "string";

  if (!hasMessage && !hasTitle && !hasSound) return;
  if (hasMessage) world.sendMessage(message);

  let titleOptions;
  if (hasTitle) {
    reusableTitleOptions.subtitle = typeof subtitle === "string" ? subtitle : "";
    titleOptions = reusableTitleOptions;
  }

  for (let i = 0; i < targets.length; i++) {
    const player = targets[i];
    if (!player?.isValid) continue;
    if (hasTitle) player.onScreenDisplay.setTitle(typeof title === "string" ? title : "", titleOptions);
    if (hasSound) player.playSound(sound, soundConfig);
  }
}

// ============================================================
//  Teleport Team
// ============================================================

const TELEPORT_CONFIG = Object.freeze({
  PRELOAD_Y: 200,
  PRELOAD_DELAY: 20,
  MEMBER_INTERVAL: 3,
  DEFAULT_Y: 120,
  MIN_Y: -64,
  MAX_Y: 320,
  MAX_SPAWN_RADIUS: 490,
});

// --- Object Pools (ประกาศก่อนใช้) ---
const positionsPool = [],
  validMembersPool = [],
  finalLocationPool = { x: 0, y: 0, z: 0 },
  teleportLocLeader = { x: 0, y: 0, z: 0 },
  effectOptionsSlowFalling = { amplifier: 255, showParticles: false };

// --- Helpers ---

function getSafeY(dimension, x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return TELEPORT_CONFIG.DEFAULT_Y;
  try {
    const block = dimension.getTopmostBlock({ x, z });
    if (!block) return TELEPORT_CONFIG.DEFAULT_Y;
    return Math.max(TELEPORT_CONFIG.MIN_Y, Math.min(TELEPORT_CONFIG.MAX_Y, block.y + 1));
  } catch {
    return TELEPORT_CONFIG.DEFAULT_Y;
  }
}

function groupPlayersByTeam() {
  const teamMap = new Map(),
    players = getUhcPlayers(),
    len = players.length;

  for (let i = 0; i < len; i++) {
    const player = players[i];
    if (!player?.isValid) continue;

    const tag = getPlayerTeam(player);
    if (!tag) continue;

    let team = teamMap.get(tag);
    if (!team) {
      team = [];
      teamMap.set(tag, team);
    }
    team.push(player);
  }
  return teamMap;
}

function generateTeamXZ(teamCount, radius) {
  const effectiveRadius = Math.min(radius, TELEPORT_CONFIG.MAX_SPAWN_RADIUS),
    angleStep = (Math.PI * 2) / teamCount,
    randomOffset = Math.random() * Math.PI * 2;

  // Reuse array + objects จาก pool
  for (let i = 0; i < teamCount; i++) {
    const angle = randomOffset + i * angleStep;
    let pos = positionsPool[i];
    if (!pos) {
      pos = { x: 0, z: 0 };
      positionsPool[i] = pos;
    }
    pos.x = Math.floor(center.x + Math.cos(angle) * effectiveRadius);
    pos.z = Math.floor(center.z + Math.sin(angle) * effectiveRadius);
  }

  positionsPool.length = teamCount; // trim excess
  return positionsPool;
}

// --- Entry Point ---

function teleportTeam(radius = borderRadius) {
  if (!Number.isFinite(radius)) radius = borderRadius;
  if (!cachedDimension) {
    world.sendMessage("§c[UHC] Error: Dimension not initialized");
    return;
  }

  const teamMap = groupPlayersByTeam(),
    teamsData = Array.from(teamMap.entries());

  if (teamsData.length === 0) return;

  world.sendMessage(`§7[UHC] Spreading ${teamsData.length} teams...`);

  const positions = generateTeamXZ(teamsData.length, radius);
  runTeamTeleportQueue(teamsData, positions, cachedDimension);
}

// --- Sequential Teleport Queue (State Machine) ---
// แทน nested closures + callback ด้วย single iterator

function runTeamTeleportQueue(teamsData, positions, dimension) {
  let teamIdx = 0;

  function nextTeam() {
    if (teamIdx >= teamsData.length) {
      world.sendMessage("§a[UHC] All teams teleported.");
      return;
    }

    const [, members] = teamsData[teamIdx],
      targetPos = positions[teamIdx];
    teamIdx++;

    if (!members?.length || !targetPos) return nextTeam();

    // กรอง valid members ลง pool
    validMembersPool.length = 0;
    for (let i = 0; i < members.length; i++) {
      if (members[i]?.isValid) validMembersPool.push(members[i]);
    }
    if (!validMembersPool.length) return nextTeam();

    // Phase 1: ส่ง leader ไปก่อนเพื่อ preload chunks
    const leader = validMembersPool[0];
    try {
      teleportLocLeader.x = targetPos.x;
      teleportLocLeader.y = TELEPORT_CONFIG.PRELOAD_Y;
      teleportLocLeader.z = targetPos.z;
      leader.teleport(teleportLocLeader, { dimension });
      leader.addEffect("slow_falling", TELEPORT_CONFIG.PRELOAD_DELAY + 20, effectOptionsSlowFalling);
    } catch {
      return nextTeam();
    }

    // Phase 2: หลัง preload → หา safe Y แล้วส่งทุกคน
    system.runTimeout(() => {
      finalLocationPool.x = targetPos.x;
      finalLocationPool.y = getSafeY(dimension, targetPos.x, targetPos.z);
      finalLocationPool.z = targetPos.z;

      // ส่ง members ทีละคน
      let mIdx = 0,
        ok = 0,
        fail = 0;
      const delay = TELEPORT_CONFIG.MEMBER_INTERVAL;

      function nextMember() {
        if (mIdx >= validMembersPool.length) {
          if (ok > 0 || fail > 0) {
            world.sendMessage(`§7[UHC] §a${ok} §7teleported${fail > 0 ? ` §c(${fail} failed)` : ""}`);
          }
          return nextTeam();
        }

        const p = validMembersPool[mIdx++];
        if (!p?.isValid) return system.runTimeout(nextMember, delay);

        try {
          p.teleport(finalLocationPool, { dimension });
          ok++;
        } catch {
          fail++;
        }

        system.runTimeout(nextMember, delay);
      }

      nextMember();
    }, TELEPORT_CONFIG.PRELOAD_DELAY);
  }

  nextTeam();
}

// ============================================================
//  Player Start Events
// ============================================================

function addItems(player) {
  if (!player?.isValid) return;
  const inv = player.getComponent("minecraft:inventory")?.container;
  if (!inv) return;
  inv.addItem(new ItemStack("minecraft:stone_axe", 1));
  inv.addItem(new ItemStack("minecraft:stone_pickaxe", 1));
  inv.addItem(new ItemStack("minecraft:cooked_beef", 3));
  inv.addItem(new ItemStack("minecraft:oak_boat", 1));
}

// Reuse explosion particle location
const explosionLocPool = { x: 0, y: 0, z: 0 };

function spawnParticles(player) {
  if (!player?.isValid || !getPlayerTeam(player)) return;
  const { x, y, z } = player.location;
  if (!player.dimension) return;

  // ตรวจสอบ world boundaries ก่อน spawn
  const particleY = y + 2.5;
  if (particleY > 320 || particleY < -64) return;

  try {
    explosionLocPool.x = x;
    explosionLocPool.y = particleY;
    explosionLocPool.z = z;
    player.dimension.spawnParticle("minecraft:huge_explosion_emitter", explosionLocPool);
  } catch (error) {}
}

// ============================================================
//  Reusable Sound Options
// ============================================================
const soundOptionsStart = { volume: 0.8, pitch: 1 },
  soundOptionsPlayers = { volume: 1, pitch: 1 },
  soundOptionsExplode = { volume: 0.7, pitch: 0.9 },
  soundOptionsPling = { volume: 1, pitch: 1 };

// ============================================================
//  Player Start Events
// ============================================================

function handleGameStart(player, tick) {
  if (tick > 26) return;
  const input = player.inputPermissions;

  switch (tick) {
    case 1:
      player.setGameMode(GameMode.Adventure);
      input?.setPermissionCategory(InputPermissionCategory.Movement, false);
      break;
    case 2:
      player.playSound("start", soundOptionsStart);
      break;
    case 4:
      player.playSound("players", soundOptionsPlayers);
      break;
    case 24:
      player.playSound("startPlayer", soundOptionsStart);
      break;
    case 26:
      input?.setPermissionCategory(InputPermissionCategory.Movement, true);
      player.setGameMode(GameMode.Survival);
      player.removeEffect("invisibility");
      player.onScreenDisplay.setTitle("Good Luck, Have Fun");
      player.playSound("random.explode", soundOptionsExplode);
      spawnParticles(player);
      break;
  }
}

// ============================================================
//  World Start Events
// ============================================================

function handleWorldStart(tick, players) {
  if (tick > 381) return;
  const len = players.length;
  if (!len) return;

  switch (tick) {
    case 1:
      teleportTeam();
      break;

    case 24:
      for (let i = 0; i < len; i++) {
        const p = players[i];
        if (p?.isValid) addItems(p);
      }
      break;

    case 26:
      world.gameRules.showCoordinates = true;
      world.gameRules.pvp = false;
      world.sendMessage("[UHC] Good Luck, Have Fun");
      break;

    case 360:
      broadcast({
        message: dynamicToast("PVP จะเปิดในอีก §c20 §fวินาที", "textures/ui/icon_multiplayer"),
        sound: "noti",
      });
      break;

    case 377:
    case 378:
    case 379:
      broadcast({
        message: dynamicToast(`PVP in §c${380 - tick}`, "textures/ui/strength_effect"),
        sound: "note.pling",
      });
      break;

    case 380:
      world.gameRules.pvp = true;
      broadcast({
        message: dynamicToast(icons.Sword + " เปิดการต่อสู้แล้ว!!", "textures/ui/icon_steve"),
        title: icons.Sword,
        subtitle: "§aเปิดการต่อสู้แล้ว!!",
        sound: "world_noti",
      });
      break;
  }
}

// ============================================================
//  Progress Bar (Action Bar HUD)
// ============================================================

const actionBar = 25,
  actionNum = 5;

const startBars = (() => {
  const prefix = "§fGame Start §l» ",
    bars = new Array(actionBar + 1);

  for (let tick = 0; tick <= actionBar; tick++) {
    const remaining = actionBar - tick,
      filled = Math.floor((tick * actionNum) / actionBar),
      empty = actionNum - filled;

    bars[tick] = prefix + "§3▌".repeat(filled) + "§f▌".repeat(empty) + ` §r${remaining}`;
  }
  return bars;
})();

function displayGameStart(p) {
  // รับ p เข้ามาจัดการทีละคน
  const tick = uhcTick;
  if (tick < 0 || tick > actionBar) return;

  // หากพ้นระยะ ActionBar แล้วไม่ต้องสนใจ
  if (!p?.isValid) return;

  const remaining = actionBar - tick,
    playSound = remaining === 20 || remaining === 10 || remaining <= 5;

  p.onScreenDisplay.setActionBar(startBars[tick]);

  if (playSound) {
    p.playSound("note.pling", soundOptionsPling);
  }
}

// ============================================================
//  Victory / Draw
// ============================================================

function checkVictory() {
  if (!isRunning) return;
  const players = getUhcPlayers(),
    len = players.length;

  if (!len) {
    triggerDraw();
    return;
  }

  // Reuse aliveTeams Set
  aliveTeamsSet.clear();

  for (let i = 0; i < len; i++) {
    const tag = getPlayerTeam(players[i]);
    if (!tag) continue;
    aliveTeamsSet.add(tag);
    if (aliveTeamsSet.size > 1) return; // ยังแข่งอยู่
  }

  if (aliveTeamsSet.size === 1) {
    triggerVictory([...aliveTeamsSet][0]);
    return;
  }
  triggerDraw();
}

// Reuse Set for victory check
const aliveTeamsSet = new Set();

function triggerVictory(winTag) {
  if (!isRunning) return;
  isRunning = false;
  world.gameRules.pvp = false;

  const teamInfo = getTeamInfo(winTag),
    teamName = teamInfo ? `${teamInfo.color}${teamInfo.name}` : winTag,
    players = getAllPlayers(),
    len = players.length;

  // Reuse victory particle location
  for (let i = 0; i < len; i++) {
    const p = players[i];
    if (!p?.isValid) continue;
    if (getPlayerTeam(p) !== winTag) continue;

    const loc = p.location,
      dim = p.dimension;

    if (loc && dim) {
      explosionLocPool.x = loc.x;
      explosionLocPool.y = loc.y + 2.5;
      explosionLocPool.z = loc.z;
      dim.spawnParticle("minecraft:huge_explosion_emitter", explosionLocPool);
    }
  }

  broadcast(players, {
    message: `VICTORY ${teamName} Wins`,
    title: "§fVICTORY",
    subtitle: `${teamName} Wins`,
    sound: "win",
  });
  startEndCountdown();
}

function triggerDraw() {
  if (!isRunning) return;
  isRunning = false;
  world.gameRules.pvp = false;
  broadcast(getAllPlayers(), { message: "[x]: No Team Survived", sound: "note.pling" });
  startEndCountdown();
}

function startEndCountdown() {
  let time = 10;
  const id = system.runInterval(() => {
    time--;
    if (time <= 5 && time > 0) world.sendMessage(`§c${icons.Hourglass} Game ending in ${time}`);
    if (time <= 0) {
      system.clearRun(id);
      endGameUhc();
    }
  }, 20);
}

// ============================================================
//  learItems and KeepCompass
// ============================================================

function clearItemsKeepCompass() {
  const players = world.getPlayers(),
    pLen = players.length;

  for (let i = 0; i < pLen; i++) {
    const p = players[i];
    if (!p?.isValid) continue;

    const inv = p.getComponent("minecraft:inventory")?.container;
    if (!inv) continue;

    let compassSlot = -1;
    const invSize = inv.size;

    // inventory
    for (let slot = 0; slot < invSize; slot++) {
      const item = inv.getItem(slot);
      if (!item) continue;

      if (item.typeId === "minecraft:compass") {
        if (compassSlot === -1) {
          compassSlot = slot;
          if (item.amount !== 1) {
            item.amount = 1;
            inv.setItem(slot, item);
          }
        } else {
          inv.setItem(slot);
        }
      } else {
        inv.setItem(slot);
      }
    }

    const equip = p.getComponent("minecraft:equippable");
    if (!equip) continue;

    // offhand + armor
    equip.setEquipment(EquipmentSlot.Offhand, undefined);
    equip.setEquipment(EquipmentSlot.Head, undefined);
    equip.setEquipment(EquipmentSlot.Chest, undefined);
    equip.setEquipment(EquipmentSlot.Legs, undefined);
    equip.setEquipment(EquipmentSlot.Feet, undefined);
  }
}

// ============================================================
//  Reusable Effect Options
// ============================================================
const effectOptionsHidden = { amplifier: 255, showParticles: false },
  effectOptionsConduit = effectOptionsHidden; // เหมือนกันทุกค่า ใช้ reference เดียวกันได้

// ============================================================
//  Export — Game Lifecycle
// ============================================================

const UHC_EFFECTS = ["regeneration", "blindness", "invisibility", "resistance", "conduit_power", "slow_falling"];

function clearUhcEffects(player) {
  if (!player?.isValid) return;
  const len = UHC_EFFECTS.length;
  for (let i = 0; i < len; i++) {
    player.removeEffect(UHC_EFFECTS[i]);
  }
}

export function startGameUhc() {
  if (isRunning) return;
  if (checkInterval !== null) {
    system.clearRun(checkInterval);
    checkInterval = null;
  }

  isRunning = true;
  setGameRunningState(true);
  uhcTick = 0;
  cachedDimension = world.getDimension("overworld");

  const players = world.getPlayers();
  const pLen = players.length;

  for (let i = 0; i < pLen; i++) {
    const p = players[i];
    if (!p?.isValid) continue;

    if (getPlayerTeam(p)) {
      p.addTag("uhc");
      p.addEffect("regeneration", 520, effectOptionsHidden);
      p.addEffect("blindness", 520, effectOptionsHidden);
      p.addEffect("invisibility", 1200, effectOptionsHidden);
      p.addEffect("resistance", 1200, effectOptionsHidden);
    } else {
      p.setGameMode(GameMode.Spectator);
      p.addEffect("conduit_power", 999999, effectOptionsConduit);
    }
  }

  refreshPlayerCaches();

  // Reset border
  nextShrinkIndex = 1;
  nextShrinkTick = FIRST_SHRINK_DELAY;
  targetRadius = null;
  wbBounds = null;
  borderReady = false;
  resetEndSequence();

  // sync geometry
  setBorderRadius(CHECKPOINTS[0]);
  borderReady = true;

  syncWorldBorderGeometry();
  // Reset UI
  aliveTeamDirty = true;
  aliveTeamBarCache = "§7-";
  scoreCache.clear();

  Objectives();
  runIntervals();
  clearItemsKeepCompass();
}

export function endGameUhc() {
  if (!isRunning) return;
  isRunning = false;

  if (checkInterval !== null) {
    system.clearRun(checkInterval);
    checkInterval = null;
  }

  const players = world.getPlayers(),
    pLen = players.length;

  for (let i = 0; i < pLen; i++) {
    const p = players[i];
    if (!p?.isValid) continue;

    if (getPlayerTeam(p)) {
      p.removeTag("uhc");
      p.addEffect("regeneration", 520, effectOptionsHidden);
    } else {
      p.setGameMode(GameMode.Adventure);
      p.removeEffect("conduit_power");
    }
  }

  clearScoreboard();
  resetAnnouncerSystem();
  setGameRunningState(false);
  refreshScoreboardUI();

  targetRadius = null;
  nextShrinkIndex = 1;
  nextShrinkTick = 0;
  uhcTick = 0;
  wbBounds = null;
  aliveTeamDirty = true;
  borderRadius = CHECKPOINTS[0];

  shrinkStartTick = 0;
  shrinkDuration = 0;
  startRadius = CHECKPOINTS[0];

  syncWorldBorderGeometry();
}

export function resetGameUhc() {
  if (checkInterval !== null) {
    system.clearRun(checkInterval);
    checkInterval = null;
  }

  isRunning = false;
  uhcTick = 0;
  nextShrinkIndex = 1;
  nextShrinkTick = FIRST_SHRINK_DELAY;
  targetRadius = null;
  borderRadius = CHECKPOINTS[0];
  resetEndSequence();

  clearAllPlayerNametags();
  syncWorldBorderGeometry();
  world.gameRules.pvp = false;

  setGameRunningState(false);

  clearScoreboard();
  scoreCache.clear();
  clearAllTeams();
  clearAllTaguhcAndDynamicProperty();

  refreshScoreboardUI();

  aliveTeamDirty = true;
  aliveTeamBarCache = "§7-";
  objective = null;

  const players = world.getPlayers();
  const pLen = players.length;

  for (let i = 0; i < pLen; i++) {
    const p = players[i];
    if (!p?.isValid) continue;
    clearUhcEffects(p);

    if (getPlayerTeam(p)) {
      p.removeTag("uhc");
      p.addEffect("regeneration", 520, effectOptionsHidden);
    } else {
      p.setGameMode(GameMode.Adventure);
      p.removeEffect("conduit_power");
    }
  }

  clearItemsKeepCompass();
  spawnLeaderboardNPC();
}

// อัปเดตพิกัด 4 ทิศ (E, W, N, S) ขอบเขตสูงสุดของวงปัจจุบัน
let wbBounds = null; // [east, west, north, south]

function syncWorldBorderGeometry() {
  const r = borderRadius;
  const { x: cx, z: cz } = center;

  wbBounds = [
    cx + r, // east
    cx - r, // west
    cz - r, // north
    cz + r, // south
  ];
}

function isOutBorder(x, z) {
  const b = wbBounds;
  if (!b) return false;

  return (
    x < b[1] || // west
    x > b[0] || // east
    z < b[2] || // north
    z > b[3] // south
  );
}

function isUhc(player) {
  return isRunning && player?.isValid && isPlayerUhcId(player.id);
}

function Cancel(player, targetEntityOrBlock) {
  if (!isUhc(player) || !wbBounds) return false;

  const { x: px, z: pz } = player.location;
  if (isOutBorder(px, pz)) return true;

  if (targetEntityOrBlock && targetEntityOrBlock.location) {
    return isOutBorder(targetEntityOrBlock.location.x, targetEntityOrBlock.location.z);
  }
  return false;
}

world.beforeEvents.playerBreakBlock.subscribe((ev) => {
  if (!isRunning) return;
  if (Cancel(ev.player, ev.block)) {
    ev.cancel = true;
  }
});

const PLACE_BLOCK_LOCK_RADIUS = 16;

world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
  if (!isRunning) return;
  if (Cancel(ev.player, ev.block)) {
    ev.cancel = true;
    return;
  }
  // เมื่อวงบีบถึง 16 หรือน้อยกว่า ห้ามวางบล็อกทุกคนที่เป็น UHC
  if (borderRadius <= PLACE_BLOCK_LOCK_RADIUS && isUhc(ev.player)) {
    ev.cancel = true;
  }
});

world.beforeEvents.playerInteractWithEntity.subscribe((ev) => {
  if (!isRunning) return;
  if (Cancel(ev.player, ev.target)) {
    ev.cancel = true;
  }
});

world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  if (!isRunning) return;
  if (Cancel(ev.player, ev.block)) {
    ev.cancel = true;
  }
});

// ============================================================
//  Chat Command — trigger Block Fill (border = 2)
// ============================================================

world.beforeEvents.chatSend.subscribe((ev) => {
  const player = ev.sender;
  if (!player?.isValid) return;
  if (!player.hasTag("admin")) return;
  if (ev.message !== "!fill") return;

  ev.cancel = true;

  system.run(() => {
    if (!isRunning) {
      player.sendMessage("§c[Fill] เกมยังไม่ได้เริ่ม");
      return;
    }

    // ข้าม checkpoint ที่เหลือทั้งหมด → กระโดดไปที่ borderEnd (2) ทันที
    nextShrinkIndex = CHECKPOINTS.length; // หยุด shrink loop ปกติ
    targetRadius = borderEnd; // smooth shrink → 2
    startRadius = borderRadius;
    shrinkStartTick = uhcTick;
    shrinkDuration = getShrinkDuration(borderEnd);
    currentBorderColor = borderColors.red;

    // reset end sequence ให้เริ่มนับใหม่หลัง shrink เสร็จ
    resetEndSequence();

    player.sendMessage(`[Fill] border กำลังบีบไปที่ ${borderEnd} แล้ว pattern จะตามมา`);

    broadcast(getUhcPlayers(), {
      message: dynamicToast(`วงกำลังบีบไปที่ ${borderEnd}`, "textures/blocks/barrier"),
      sound: "world_noti",
    });
  });
});
