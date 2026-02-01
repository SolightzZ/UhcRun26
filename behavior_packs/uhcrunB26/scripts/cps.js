// จำกัด CPS (คลิกต่อวินาที) — kick ถ้าเกิน
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, Player } from "@minecraft/server";

// ========== ตัวเลข (number) ==========
const num = {
  maxCps: 18,
  windowMs: 1000,
};

// ========== ข้อความ (text) ==========
const txt = {
  kickReason: "CPS over",
};

// เก็บเวลาคลิกล่าสุดและจำนวน hit ต่อผู้เล่น — WeakMap O(1)
const lastHitTime = new WeakMap();
const hitCount = new WeakMap();

function isPlr(entity) {
  return entity instanceof Player;
}

function now() {
  return Date.now();
}

function resetWindow(player, time) {
  lastHitTime.set(player, time);
  hitCount.set(player, 1);
}

function addHit(player) {
  hitCount.set(player, (hitCount.get(player) ?? 0) + 1);
}

function getHits(player) {
  return hitCount.get(player) ?? 0;
}

// เช็คว่าเป็น window ใหม่หรือยัง (เกิน windowMs แล้ว)
function isNewWindow(player, time) {
  const last = lastHitTime.get(player);
  return !last || time - last >= num.windowMs;
}

async function kickPlr(player) {
  const name = player.name;
  const hits = getHits(player);

  console.warn(`[CPS] ${name} kicked: ${hits}/${num.maxCps}`);
  world.sendMessage(`§c[CPS] ${name} ${hits}/${num.maxCps}`);

  try {
    await player.runCommand(`kick "${name}" §r\n§fUHC§6Run§7\n§g${name} §cout: CPS ${hits}/${num.maxCps}\n(Auto-cheat)`);
  } catch {
    await player.runCommand(`kick "${name}" ${txt.kickReason}`);
  }
}

// เช็ค CPS: window ใหม่ -> reset, ไม่ใช่ -> เพิ่ม hit แล้วเช็คเกินหรือไม่
function checkCps(player) {
  const time = now();

  if (isNewWindow(player, time)) {
    resetWindow(player, time);
    return;
  }

  addHit(player);

  if (getHits(player) > num.maxCps) {
    kickPlr(player);
  }
}

function onEntityHit(event) {
  const damager = event.damagingEntity;
  if (!isPlr(damager)) return;

  checkCps(damager);
}

world.afterEvents.entityHitEntity.subscribe(onEntityHit, {
  maxEventsPerTick: 100,
});
