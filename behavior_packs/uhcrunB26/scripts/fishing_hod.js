// เบ็ดตกปลาถูก entity -> damage + knockback + ลบ projectile
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system } from "@minecraft/server";

// ========== ตัวเลข (number) ==========
const num = {
  damage: 0.5,
  baseKb: 1.5,
  randomKb: 0.5,
  vertical: 0.5,
  removeTicks: 1,
};

// ========== ข้อความ (text) / id ==========
const id = {
  hook: "minecraft:fishing_hook",
  plr: "minecraft:player",
  soundCast: "minecraft:item.fishing_rod.cast",
};

function isPlr(entity) {
  return entity?.typeId === id.plr;
}

function isHook(proj) {
  return proj?.typeId === id.hook;
}

// เช็คว่าเป้าหมายเป็นผู้เล่น อีกฝ่ายเป็นผู้เล่น และ projectile เป็นเบ็ด และไม่ตีตัวเอง
function canHookHit(target, source, proj) {
  if (!isPlr(target)) return false;
  if (!isPlr(source)) return false;
  if (!isHook(proj)) return false;
  if (target.id === source.id) return false;
  return true;
}

function calcKb() {
  return num.baseKb + Math.random() * num.randomKb;
}

function applyDamage(target) {
  target.applyDamage(num.damage);
}

function applyKb(target, source) {
  const dir = source.getViewDirection();
  const force = calcKb();
  target.applyKnockback(dir.x, dir.z, force, num.vertical);
}

function playSound(plr) {
  plr.playSound(id.soundCast, { volume: 0.8, pitch: 1.0 });
}

function removeProjLater(proj) {
  system.runTimeout(() => {
    if (proj?.isValid()) {
      proj.remove();
    }
  }, num.removeTicks);
}

function onProjectileHit(e) {
  const target = e.getEntityHit()?.entity;
  const proj = e.projectile;
  const source = e.source;

  if (!canHookHit(target, source, proj)) return;

  applyDamage(target);
  applyKb(target, source);
  playSound(source);
  removeProjLater(proj);
}

world.afterEvents.projectileHitEntity.subscribe(onProjectileHit);
