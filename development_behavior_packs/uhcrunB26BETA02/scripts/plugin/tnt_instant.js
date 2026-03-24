import { world } from "@minecraft/server";

const TNT = "minecraft:tnt";

const tntOffset = {
  x: 0.5,
  y: 0.4,
  z: 0.5,
};

world.afterEvents.playerPlaceBlock.subscribe(
  (e) => {
    const block = e.block;
    const { x, y, z } = block.location;
    const dim = block.dimension;

    block.setType("minecraft:air");

    dim.spawnEntity(TNT, {
      x: x + tntOffset.x,
      y: y + tntOffset.y,
      z: z + tntOffset.z,
    });
  },
  {
    blockTypes: [TNT],
  },
);
