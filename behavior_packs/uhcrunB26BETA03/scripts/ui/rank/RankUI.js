import { ActionFormData } from '@minecraft/server-ui';
import { CONFIG } from '../../constants/game.js';
import { flushIfDirty, getAllPlayersSorted, getPlayerDeathStats, getPlayerKillStats, getTeamKillStats, getTeamsSorted } from '../../features/rank/RankData.js';
import { getRankTier } from '../../features/rank/RankTiers.js';
import { TEAM_LOOKUP } from '../../features/team/State_Team.js';
import { logError } from '../../shared/Util.js';
import { openMainMenu } from '../menu/MenuMain.js';

const RANK_PREFIXES = ['§6#1', '§f#2', '§e#3'];
function rankPrefix(i) {
   return RANK_PREFIXES[i] ?? `§7#${i + 1}`;
}

export function openRankMenu(player) {
   flushIfDirty();

   const form = new ActionFormData();
   form.title(CONFIG.title);
   form.body('§6UHCRun26 | Ranks');

   form.button('§bMatch', 'textures/ui/sale_banner.png');
   form.button('§ePlacement', 'textures/ui/marketplace_pause_menu_icon.png');
   form.button('§aSurvival', 'textures/ui/xbox4.png');
   form.button('§5K/D/A', 'textures/ui/multiplayer_glyph_color.png');
   form.button('Back', 'textures/ui/wysiwyg_reset.png');

   form
      .show(player)
      .then((res) => {
         if (res.canceled || res.selection === undefined) return;
         switch (res.selection) {
            case 0:
               openCurrentMatch(player);
               break;
            case 1:
               openTeamPlacement(player);
               break;
            case 2:
               openPlayerSurvival(player);
               break;
            case 3:
               openKDABoard(player);
               break;
            case 4:
               openMainMenu(player);
               break;
         }
      })
      .catch((error) => {
         logError('RankUI', 'Rank menu form failed', error);
      });
}

function openCurrentMatch(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Current Match');

   let body = '';

   const teamKillStats = getTeamKillStats();
   body += '§bTop Teams (Kills)\n';
   if (teamKillStats.length === 0) {
      body += '§7No stats in this match yet.\n';
   } else {
      for (let i = 0; i < Math.min(teamKillStats.length, 5); i++) {
         const t = teamKillStats[i];
         body += `${RANK_PREFIXES[i] ?? `§e#${i + 1}`} ${t.name} §f- §c${t.kills} Kills\n`;
      }
   }

   body += '\n';

   const playerKillStats = getPlayerKillStats();
   body += '§eTop Players (Kills)\n';
   if (playerKillStats.length === 0) {
      body += '§7No stats in this match yet.\n';
   } else {
      for (let i = 0; i < Math.min(playerKillStats.length, 5); i++) {
         const p = playerKillStats[i];
         const teamLabel = p.teamLabel ? ` §8[${p.teamLabel}]` : '';
         body += `${RANK_PREFIXES[i] ?? `§e#${i + 1}`} §a${p.name}${teamLabel} §f- §c${p.kills} Kills\n`;
      }
   }

   body += '\n';

   const playerDeathStats = getPlayerDeathStats();
   body += '§cTop Players (Deaths)\n';
   if (playerDeathStats.length === 0) {
      body += '§7No stats in this match yet.\n';
   } else {
      for (let i = 0; i < Math.min(playerDeathStats.length, 5); i++) {
         const p = playerDeathStats[i];
         const teamLabel = p.teamLabel ? ` §8[${p.teamLabel}]` : '';
         body += `${RANK_PREFIXES[i] ?? `§e#${i + 1}`} §a${p.name}${teamLabel} §f- §4${p.deaths} Deaths\n`;
      }
   }

   form.body(body);
   form.divider();
   form.button('Back', 'textures/ui/wysiwyg_reset.png');

   form
      .show(player)
      .then((res) => {
         if (res.canceled) return;
         openRankMenu(player);
      })
      .catch((error) => {
         logError('RankUI', 'Current Match form failed', error);
      });
}

function openTeamPlacement(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Team Placement');

   const teamsSorted = getTeamsSorted();

   if (teamsSorted.length === 0) {
      form.body('§7No placement stats yet.\n\nPlay matches to get team points!');
   } else {
      let body = '§eTeam Rankings\n§7(Points: last surviving)\nTeamgets most points\n\n';
      for (let i = 0; i < teamsSorted.length; i++) {
         const t = teamsSorted[i];
         const teamInfo = TEAM_LOOKUP.get(t.id);
         const teamColor = teamInfo ? teamInfo.color : '§f';
         const teamName = teamInfo ? teamInfo.name : t.id;
         const firsts = t.placements['1'] || 0;
         const seconds = t.placements['2'] || 0;
         body += `${rankPrefix(i)} ${teamColor}${teamName} §7- §f${t.points} pts §7(#1:§f${firsts} #2:§f${seconds})\n`;
      }
      form.body(body);
   }

   form.divider();
   form.button('Back', 'textures/ui/wysiwyg_reset.png');

   form
      .show(player)
      .then((res) => {
         if (res.canceled) return;
         openRankMenu(player);
      })
      .catch((error) => {
         logError('RankUI', 'Team Placement form failed', error);
      });
}

function openPlayerSurvival(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Player Survival');

   const allPlayers = getAllPlayersSorted();
   const survivors = allPlayers.filter((p) => p.survivedLast > 0);
   survivors.sort((a, b) => b.survivedLast - a.survivedLast);

   if (survivors.length === 0) {
      form.body('§7No survival stats yet.\n\nBe the last survivor of your team!');
   } else {
      let body = '§eLast Survivors (Tournament)\n\n';
      for (let i = 0; i < Math.min(survivors.length, 10); i++) {
         const p = survivors[i];
         body += `${rankPrefix(i)} §a${p.name} §7- §f${p.survivedLast} Games\n`;
      }
      form.body(body);
   }

   form.divider();
   form.button('Back', 'textures/ui/wysiwyg_reset.png');

   form
      .show(player)
      .then((res) => {
         if (res.canceled) return;
         openRankMenu(player);
      })
      .catch((error) => {
         logError('RankUI', 'Player Survival form failed', error);
      });
}

function openKDABoard(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | KDA Leaderboard');

   const allPlayers = getAllPlayersSorted();
   const myData = allPlayers.find((p) => p.name === player.name);

   let body = '';

   if (myData) {
      const tier = getRankTier(myData.kd, myData.games);
      body += `§eYour Rank: ${tier.color}${tier.name} §7(K/D §f${myData.kd.toFixed(2)}§7)\n`;
      body += `Kills: §c${myData.kills} §7| Deaths: §4${myData.deaths}\n`;
      body += `Games: §f${myData.games} §7| Wins: §a${myData.wins}\n\n`;
   } else {
      body += '§eYour Rank: §7Unranked\n\n';
   }

   body += '§eTop Players (K/D)\n';
   const ranked = allPlayers.filter((p) => p.games > 0);
   if (ranked.length === 0) {
      body += '§7No tournament stats yet.\n';
   } else {
      for (let i = 0; i < Math.min(ranked.length, 10); i++) {
         const p = ranked[i];
         const tier = getRankTier(p.kd, p.games);
         body += `${rankPrefix(i)} ${tier.color}${p.name} §7- K/D §e${p.kd.toFixed(2)} §7(${tier.color}${tier.name}§7)\n`;
      }
   }

   form.body(body);
   form.divider();
   form.button('Back', 'textures/ui/wysiwyg_reset.png');

   form
      .show(player)
      .then((res) => {
         if (res.canceled) return;
         openRankMenu(player);
      })
      .catch((error) => {
         logError('RankUI', 'KDA Leaderboard form failed', error);
      });
}
