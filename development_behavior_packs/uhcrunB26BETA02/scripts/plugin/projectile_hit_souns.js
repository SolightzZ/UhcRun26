import { world } from "@minecraft/server";

const projSet = new Set([
  "minecraft:arrow",
  "minecraft:thrown_trident",
  "minecraft:snowball",
  "minecraft:egg",
  "minecraft:blue_egg",
  "minecraft:brown_egg",
]);

world.afterEvents.projectileHitEntity.subscribe((e) => {
  const proj = e.projectile;
  if (!proj || !projSet.has(proj.typeId)) return;

  const target = e.getEntityHit()?.entity;
  const src = e.source;

  if (!target || !src) return;
  if (target.typeId !== "minecraft:player") return;
  if (src.typeId !== "minecraft:player") return;
  if (target.id === src.id) return;

  src.playSound("random.orb", { volume: 0.5, pitch: 1 });
});
