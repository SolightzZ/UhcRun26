import { CustomCommandStatus, system } from "@minecraft/server";
import { CommandMap } from "./function.js";

export function HandlerCustomCommands({ customCommandRegistry }) {
  for (const name in CommandMap) {
    const data = CommandMap[name];

    try {
      customCommandRegistry.registerCommand(
        {
          name,
          description: data.description,
          permissionLevel: data.permission,
          cheatsRequired: false,
        },
        (origin) => {
          const source = origin.initiator ?? origin.sourceEntity;

          system.run(() => {
            try {
              data.handler(source);
            } catch (error) {
              console.warn(`[Command] ${name} failed:`, error);
              if (source?.isValid && typeof source.sendMessage === "function") {
                source.sendMessage(
                  `§c[Command] §f${name} §cfailed: ${error?.message ?? error}`,
                );
              }
            }
          });

          return { status: CustomCommandStatus.Success };
        },
      );
    } catch (error) {
      console.warn(
        `[Command] Failed to register custom command '${name}':`,
        error,
      );
    }
  }
}
