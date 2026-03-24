import { world, system } from "@minecraft/server";

const cfg = {
  damage: 0.5,
  kbH: 1.25,
  kbV: 0.38,
  hitCooldown: 6,
};

const id = {
  hook: "minecraft:fishing_hook",
  plr: "minecraft:player",
  sound: "minecraft:item.fishing_rod.cast",
};

const hitCache = new Map();
const kbVec = { x: 0, z: 0 };
const soundOpts = { volume: 0.7, pitch: 1 };

function getTarget(ev) {
  if (ev.entityHit) return ev.entityHit;

  if (typeof ev.getEntityHit !== "function") return undefined;

  const hit = ev.getEntityHit();
  return hit?.entity;
}

function canHit(target, source) {
  if (!target) return false;
  if (!source) return false;
  if (target.typeId !== id.plr) return false;
  if (source.typeId !== id.plr) return false;
  if (target.id === source.id) return false;

  const tick = system.currentTick;
  const last = hitCache.get(target.id);

  if (last && tick - last < cfg.hitCooldown) return false;

  hitCache.set(target.id, tick);
  return true;
}

function applyKb(target, source) {
  const dir = source.getViewDirection();

  const ax = Math.abs(dir.x);
  const az = Math.abs(dir.z);
  const inv = 1 / (ax + az || 1);

  kbVec.x = dir.x * inv * cfg.kbH;
  kbVec.z = dir.z * inv * cfg.kbH;

  target.applyKnockback(kbVec, cfg.kbV);
}

world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const proj = ev.projectile;

  if (!proj) return;
  if (proj.typeId !== id.hook) return;

  const source = ev.source;
  if (!source) return;

  const target = getTarget(ev);
  if (!canHit(target, source)) return;

  applyKb(target, source);

  source.playSound(id.sound, soundOpts);

  system.run(() => {
    if (proj?.isValid) proj.remove();
  });
});
