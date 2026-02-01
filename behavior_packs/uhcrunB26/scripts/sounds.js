// ลูกธนู/ตรีเดนท์/สโนว์บอลโดนผู้เล่น = เล่นเสียง | วาง TNT = กลายเป็น TNT จุดระเบิด
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { world, system } from "@minecraft/server";

// ========== ตัวเลข (number) ==========
const num = {
  tntX: 0.5,
  tntY: 0.4,
  tntZ: 0.5,
  soundVol: 0.5,
  soundPitch: 1,
};

// ประเภท projectile ที่นับ (Set O(1))
const projSet = new Set([
  "minecraft:arrow",
  "minecraft:thrown_trident",
  "minecraft:snowball",
]);

// ID บล็อก/เอ็นติตี้ TNT (ข้อความ)
const txtTnt = "minecraft:tnt";

// เช็คว่าโดนถูกต้อง (ผู้เล่นยิงผู้เล่น, projectile อยู่ใน Set, ไม่ยิงตัวเอง)
function okHit(target, proj, src) {
  if (!target || !proj || !src) return false;
  if (target.typeId !== "minecraft:player") return false;
  if (src.typeId !== "minecraft:player") return false;
  if (!projSet.has(proj.typeId)) return false;
  if (target.id === src.id) return false;
  return true;
}

// เล่นเสียงโดนที่ผู้ยิง
function playHit(pl) {
  pl.playSound("random.orb", { volume: num.soundVol, pitch: num.soundPitch });
}

// วาง TNT แล้วสปอน TNT จุดระเบิด (ลบบล็อกก่อน)
function spawnTnt(block) {
  const { x, y, z } = block.location;
  const dim = block.dimension;

  system.run(() => {
    block.setType("minecraft:air");
    dim.spawnEntity(txtTnt, {
      x: x + num.tntX,
      y: y + num.tntY,
      z: z + num.tntZ,
    });
  });
}

// รับ event projectile โดน entity
function onProjHit(e) {
  const target = e.getEntityHit()?.entity;
  const proj = e.projectile;
  const src = e.source;

  if (!okHit(target, proj, src)) return;
  playHit(src);
}

// รับ event วางบล็อก: ถ้าเป็น TNT ให้ spawn TNT จุดระเบิด
function onPlace(e) {
  const block = e.block;
  if (block.typeId !== txtTnt) return;
  spawnTnt(block);
}

world.afterEvents.projectileHitEntity.subscribe(onProjHit);
world.afterEvents.playerPlaceBlock.subscribe(onPlace);
