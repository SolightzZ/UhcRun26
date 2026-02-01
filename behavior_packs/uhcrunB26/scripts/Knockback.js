// Knockback ตอน PvP และแผ่นพิเศษ (crimson pressure plate)
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta
// โครงสร้าง: FP + Event-driven, ชื่อสั้น ไม่มี _

import { world } from "@minecraft/server";

// ========== ตัวเลข (number) ==========
const num = {
  hitH: 0.76,
  hitV: 0.42,
  plateH: 3,
  plateV: 1.5,
  nearDist: 2,
};

// เสียงสุ่ม (array)
const soundList = [
  "mob.shulker.shoot",
  "firework.blast",
  "firework.large_blast",
  "firework.twinkle",
];

// แผ่นพิเศษที่ทำให้ knockback — Set O(1) lookup
const plateSet = new Set(["minecraft:crimson_pressure_plate"]);

// ใส่ knockback ตามทิศและแรง
function doKb(pl, dir, h, v) {
  const hor = { x: dir.x, z: dir.z };
  pl.applyKnockback(hor, v);
}

// เล่นเสียงสุ่มที่ตำแหน่งผู้เล่น
function playRand(dim, loc) {
  const s = soundList[Math.floor(Math.random() * soundList.length)];
  dim.playSound(s, loc);
}

// หาผู้เล่นใกล้บล็อก (ระยะ num.nearDist) — O(entities ในระยะ)
function nearPlr(block) {
  return block.dimension.getEntities({
    location: block.location,
    maxDistance: num.nearDist,
    type: "minecraft:player",
  })[0];
}

// เช็ค PvP ถูกต้อง (ผู้เล่นตีผู้เล่น)
function okPvp(victim, attacker) {
  return (
    victim?.typeId === "minecraft:player" &&
    attacker?.typeId === "minecraft:player" &&
    typeof attacker.getViewDirection === "function"
  );
}

// รับ event entity Hurt: PvP -> knockback แบบ hit
function onHurt(e) {
  const victim = e.hurtEntity;
  const attacker = e.damageSource?.damagingEntity;

  if (!okPvp(victim, attacker)) return;

  const dir = attacker.getViewDirection();
  doKb(victim, dir, num.hitH, num.hitV);
}

// รับ event pressure plate: แผ่นพิเศษ -> knockback แบบ plate + เสียง
function onPlate(e) {
  const block = e.block;
  if (!plateSet.has(block.typeId)) return;

  const pl = nearPlr(block);
  if (!pl) return;

  const dir = pl.getViewDirection();
  doKb(pl, dir, num.plateH, num.plateV);
  playRand(block.dimension, pl.location);
}

world.afterEvents.entityHurt.subscribe(onHurt);
world.afterEvents.pressurePlatePush.subscribe(onPlate);
