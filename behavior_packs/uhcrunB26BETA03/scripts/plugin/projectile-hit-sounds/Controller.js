import model from "./Model.js";

class Controller {
  onProjectileHitEntity = (ev) => {
    if (!ev.projectile?.isValid || !model.PROJECTILES.has(ev.projectile.typeId))
      return;

    let shooter = null;
    try {
      shooter = ev.source?.isValid
        ? ev.source
        : (ev.projectile.getComponent("minecraft:projectile")?.owner ?? null);
    } catch (e) {
      console.warn("[ProjectileHitSounds] Failed to resolve shooter:", e);
    }
    if (shooter?.typeId !== "minecraft:player") return;

    let target = null;
    try {
      target = ev.getEntityHit()?.entity;
    } catch (e) {
      console.warn(
        "[ProjectileHitSounds] Failed to get entity hit information:",
        e,
      );
    }

    if (target?.isValid) {
      const sLoc = shooter.location;
      const tLoc = target.location;
      const dist = Math.hypot(
        tLoc.x - sLoc.x,
        tLoc.y - sLoc.y,
        tLoc.z - sLoc.z,
      );

      // Scale pitch by +0.05 per 10 blocks (base 0.5, capped at 1.5)
      const pitch = Math.min(1.5, 0.5 + (dist / 10) * 0.05);
      shooter.playSound("random.orb", {
        location: shooter.location,
        volume: 0.7,
        pitch: pitch,
      });
      if (target.typeId === "minecraft:player") {
        shooter.onScreenDisplay.setActionBar(
          `${target.name} §7(§b${dist.toFixed(1)}m§7)`,
        );
      }
    } else {
      shooter.playSound("random.orb", {
        location: shooter.location,
        volume: 0.7,
        pitch: 0.5,
      });
    }
  };
}

export default new Controller();
