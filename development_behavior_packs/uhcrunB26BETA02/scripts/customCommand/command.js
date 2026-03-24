import { system, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { CommandMap } from "./function.js";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  for (const [name, handler] of Object.entries(CommandMap)) {
    customCommandRegistry.registerCommand(
      { name, description: "CustomCommand", permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false },
      (origin) => {
        const source = origin.initiator ?? origin.sourceEntity;
        system.run(() => {
          handler(source);
        });
        return { status: CustomCommandStatus.Success };
      },
    );
  }
});
