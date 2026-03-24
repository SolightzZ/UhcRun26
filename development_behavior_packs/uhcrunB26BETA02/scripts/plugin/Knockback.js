import { world } from "@minecraft/server";
import { KB, clamp, normalizeXZ } from "./Util";

world.afterEvents.entityHurt.subscribe((e) => {
  const victim = e.hurtEntity;
  const attacker = e.damageSource?.damagingEntity;

  if (!victim || !attacker) return;
  if (victim.typeId !== "minecraft:player") return;
  if (attacker.typeId !== "minecraft:player") return;

  const ax = attacker.location.x;
  const az = attacker.location.z;

  const vx = victim.location.x;
  const vz = victim.location.z;

  const dir = normalizeXZ(vx - ax, vz - az);

  const x = clamp(dir.x * KB.horizontal, KB.maxHorizontal);
  const z = clamp(dir.z * KB.horizontal, KB.maxHorizontal);

  victim.applyKnockback({ x, z }, KB.vertical);
});
