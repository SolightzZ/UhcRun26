// รับ event จากเกม (scriptEvent) แล้วเรียก go/stop/reset แบบ event-driven
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

import { system } from "@minecraft/server";
import { go, stop } from "./game.js";
import { reset } from "./start.js";

// รับ script event: main:start เริ่มเกม, main:stop หยุดเกม, start:clear/s:c รีเซ็ตเริ่มเกม
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (!event.sourceEntity) return;

  switch (event.id) {
    case "main:start":
      go();
      break;
    case "main:stop":
      stop();
      break;
    case "start:clear":
    case "s:c":
      reset();
      break;
    default:
      break;
  }
});
