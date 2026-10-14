import { enqueuePlayerMessage, enqueuePlayerSound } from '../../shared/MessageBatcher.js';
import { logError } from '../../shared/Util.js';
import { playerTeamCache } from '../cache/State_Cache.js';
import { getRecentHitEntry, resolveKiller } from '../kill/HitTracker.js';
import { TEAM_LOOKUP, playerStats } from '../team/State_Team.js';

function getKillerDisplay(player) {
   const resolvedKiller = resolveKiller(player.id);
   if (!resolvedKiller?.isValid || resolvedKiller.id === player.id) {
      return getEnvironmentDeath(player.id);
   }

   const teamId = playerTeamCache.get(resolvedKiller.id);
   if (!teamId) return resolvedKiller.name;

   const team = TEAM_LOOKUP.get(teamId);
   if (!team) return resolvedKiller.name;

   return `${team.color}${resolvedKiller.name}§r`;
}

function getEnvironmentDeath(playerId) {
   switch (resolveDeathCause(playerId)) {
      case 'fall':
         return 'fall damage';
      case 'lava':
         return 'lava';
      case 'fire':
      case 'fire_tick':
         return 'fire';
      case 'drowning':
         return 'drowning';
      case 'void':
         return 'the void';
      case 'explosion':
         return 'explosion';
      case 'projectile':
         return 'shot';
      case 'entityAttack':
      case 'entity_attack':
         return 'mob attack';
      case 'self':
         return 'self-inflicted damage';
      case 'player':
         return 'player attack';
      case 'environment':
         return 'died';
      default:
         return 'died';
   }
}

export function resolveDeathCause(victimId) {
   const entry = getRecentHitEntry(victimId);
   if (!entry) return 'environment';

   if (entry.isSelfInflicted) return 'self';
   if (!entry.attackerId) return entry.damageType ?? entry.cause ?? 'environment';
   return 'player';
}

export function getDeathDisplayInfo(player) {
   const resolvedKiller = resolveKiller(player.id);
   if (resolvedKiller?.isValid && resolvedKiller.id !== player.id) {
      return { isPlayerKill: true, text: getKillerDisplay(player) };
   }

   const cause = resolveDeathCause(player.id);
   return { isPlayerKill: false, cause, text: getEnvironmentDeath(player.id) };
}

export function sendDeathMessage(player, deathInfo) {
   try {
      enqueuePlayerSound(player, 'warzone-Warzone-Defeat', { volume: 0.8 });

      const stats = playerStats.get(player.id) ?? { kills: 0, deaths: 0 };
      const detailLine = deathInfo?.isPlayerKill ? `§eKilled by §r${deathInfo.text}` : `§eCause: §r${deathInfo?.text ?? 'unknown'}`;

      enqueuePlayerMessage(
         player,
         `\n` +
            `§7==========================\n` +
            `§c            YOU DIED\n` +
            `§7==========================\n\n` +
            `${detailLine}\n\n` +
            `§eSTATS\n` +
            `§7 » Kills: §c${stats.kills}\n` +
            `§7 » Deaths: §c${stats.deaths}\n\n` +
            `§9 » Sleeplite: discord.gg/gtqfbmvTJK\n\n` +
            `§7==========================\n\n`,
      );
   } catch (error) {
      logError('Stats', 'Failed to send death message', error);
   }
}
