import { world } from "@minecraft/server";
import { KB, clamp } from "./Util";

const PLATE = Object.freeze({
  horizontal: 0.35,
  vertical: 1.2,
  nearDist: 1.75,
});

const plateSet = new Set(["minecraft:crimson_pressure_plate"]);
const sounds = ["mob.shulker.shoot", "firework.blast", "firework.large_blast", "firework.twinkle"];

world.afterEvents.pressurePlatePush.subscribe((e) => {
  const block = e.block;

  if (!plateSet.has(block.typeId)) return;

  const players = block.dimension.getEntities({
    location: block.location,
    maxDistance: PLATE.nearDist,
    type: "minecraft:player",
    closest: 1,
  });

  const pl = players[0];
  if (!pl) return;

  const dir = pl.getViewDirection();

  const x = clamp(dir.x * PLATE.horizontal, KB.maxHorizontal);
  const z = clamp(dir.z * PLATE.horizontal, KB.maxHorizontal);

  pl.applyKnockback({ x, z }, PLATE.vertical);

  const s = sounds[(Math.random() * sounds.length) | 0];
  block.dimension.playSound(s, pl.location);
});
