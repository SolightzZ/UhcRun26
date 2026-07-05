import { CommandPermissionLevel, CustomCommandStatus, system } from '@minecraft/server';
import { toggleProfiler } from '../shared/profiler/index.js';
import { logError } from '../shared/Util.js';
import { openMainMenu } from '../ui/menu/MenuMain.js';
import { uhcCheck, uhcClear, uhcClearAll } from './cache-commands.js';
import { tpa } from './tpa.js';
import { uhcEnd, uhcReset, uhcSetup, uhcStart } from './uhc-commands.js';

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
               aliases: [],
            },
            (origin) => {
               const source = origin.initiator ?? origin.sourceEntity;

               system.run(() => {
                  try {
                     data.handler(source);
                  } catch (error) {
                     logError('Command', name + ' failed', error);
                     if (source?.isValid && typeof source.sendMessage === 'function') {
                        source.sendMessage(`§c[Command] §f${name} §cfailed: ${error?.message ?? error}`);
                     }
                  }
               });

               return { status: CustomCommandStatus.Success };
            },
         );
      } catch (error) {
         logError('Command', "Failed to register custom command '" + name + "'", error);
      }
   }
}

export const CommandMap = {
   'addon:uhcsetup': {
      description: 'Setup UHC world (spawn, gamerules, leaderboard)',
      handler: uhcSetup,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcreset': {
      description: 'Reset UHC world to pre-game state',
      handler: uhcReset,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcstart': {
      description: 'Start the UHC match (spread players, enable PVP)',
      handler: uhcStart,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:uhcend': {
      description: 'End the UHC match',
      handler: uhcEnd,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:tpa': {
      description: 'Request to teleport to another player',
      handler: tpa,
      permission: CommandPermissionLevel.Any,
   },
   'addon:gui': {
      description: 'Open the main admin GUI menu',
      handler: openMainMenu,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:profiler': {
      description: 'Toggle tick-budget profiler on/off (reports every 30s via console)',
      handler: toggleProfiler,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:check': {
      description: 'Check current sizes of UHC runtime caches',
      handler: uhcCheck,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:clear': {
      description: 'Clear UHC match runtime caches (keeps lifetime stats)',
      handler: uhcClear,
      permission: CommandPermissionLevel.GameDirectors,
   },
   'addon:clearall': {
      description: 'Clear all UHC caches including player/team stats',
      handler: uhcClearAll,
      permission: CommandPermissionLevel.GameDirectors,
   },
};
