// logic ระยะ border, particle, เตือนผู้เล่นนอก border แยกเป็น function
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { num, txt } from "./config.js";

const center = { x: num.centerX, z: num.centerZ };

// ระยะใกล้สุดถึงขอบ border (min จาก 4 ทิศ) — O(1)
export function dist(loc, radius) {
  return Math.min(
    Math.abs(center.x + radius - loc.x),
    Math.abs(center.x - radius - loc.x),
    Math.abs(center.z + radius - loc.z),
    Math.abs(center.z - radius - loc.z)
  );
}

// ระยะไกลสุดจากศูนย์ (max ของ abs x, z) — O(1)
export function maxDist(loc) {
  return Math.max(Math.abs(loc.x), Math.abs(loc.z));
}

// เตือนผู้เล่นที่อยู่นอก border: particle, damage, fade, sound
export function warn(player, radius) {
  const { x, z, y } = player.location;
  if (Math.abs(x) <= radius && Math.abs(z) <= radius) return;

  const hyp = Math.hypot(center.x - x, center.z - z) || 1;
  const dx = ((center.x - x) / hyp) * 2;
  const dz = ((center.z - z) / hyp) * 2;

  player.dimension.spawnParticle("arrow", {
    x: x + dx,
    y: y + 1,
    z: z + dz,
  });

  if (Math.random() < 0.65) {
    player.onScreenDisplay.setActionBar(txt.borderWarn);
    player.playSound("hit.netherite");
    player.applyDamage(num.damageOutBorder, { cause: "void", damagingEntity: null });
    player.camera.fade({
      fadeTime: { fadeInTime: 0, holdTime: 0, fadeOutTime: 0.5 },
      fadeColor: { red: 0.5, green: 0.1, blue: 0.1 },
    });
  }
}

// คำนวณจุด particle ที่อยู่ใกล้ผู้เล่น (ในระยะ viewRange)
function addPoint(particles, loc, x, y, z) {
  const dx = Math.abs(x - loc.x);
  const dz = Math.abs(z - loc.z);
  if (dx <= num.viewRange && dz <= num.viewRange) {
    const yClamp = Math.max(num.particleYClampMin, Math.min(num.particleYClampMax, y));
    particles.push({ x, y: yClamp, z });
  }
}

// แสดง particle border รอบผู้เล่นที่ใกล้ border
export function showParticle(player, radius) {
  const { location, dimension } = player;
  const d = dist(location, radius);
  if (d > num.nearBorder) return;

  const strength = Math.max(0, 1 - d / num.nearBorder);
  const range =
    (Math.min((Math.sqrt(num.maxParticle) * num.particleSpace) / 1.5, num.nearBorder) * strength);

  const particles = [];
  const corners = [
    { x: center.x + radius },
    { x: center.x - radius },
    { z: center.z + radius },
    { z: center.z - radius },
  ];

  for (const corner of corners) {
    const dx = corner.x != null ? Math.abs(corner.x - location.x) : 0;
    const dz = corner.z != null ? Math.abs(corner.z - location.z) : 0;
    if (Math.sqrt(dx * dx + dz * dz) > num.nearBorder) continue;

    for (let ox = -range; ox < range; ox += num.particleSpace) {
      for (let oy = -range; oy < range; oy += num.particleSpace) {
        const px = corner.x ?? Math.max(center.x - radius, Math.min(center.x + radius, location.x + ox));
        const pz = corner.z ?? Math.max(center.z - radius, Math.min(center.z + radius, location.z + ox));
        addPoint(particles, location, px, location.y + oy, pz);
      }
    }
  }

  const take = particles.sort(() => Math.random() - 0.5).slice(0, num.maxParticle);
  for (const { x, y, z } of take) {
    dimension.spawnParticle("borderX", { x, y: y + 2, z });
  }
}
