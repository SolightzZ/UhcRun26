//Rank UI — หน้าต่าง Leaderboard 4 แท็บ สำหรับระบบ Rank (server-ui only)
import { ActionFormData } from '@minecraft/server-ui';
import { logError } from '../../shared/Util.js';
import { getRankTier } from '../../features/rank/RankTiers.js';
import { getAllPlayersSorted, getTeamsSorted, flushIfDirty, getTeamKillStats, getPlayerKillStats, getPlayerDeathStats } from '../../features/rank/RankData.js';
import { playerTeamCache } from '../../features/cache/State_Cache.js';
import { TEAM_LOOKUP } from '../../features/team/State_Team.js';
import { CONFIG } from '../../constants/game.js';

//เปิดเมนูหลัก Rank (4 ปุ่ม)
export function openRankMenu(player) {
   flushIfDirty();

   const form = new ActionFormData();
   form.title(CONFIG.title);
   form.body('§6UHCRun26 | Ranks');
   form.button('§bCurrent Match');
   form.button('§eTeam Placement');
   form.button('§aPlayer Survival');
   form.button('§5KDA');
   form.button('Back', 'textures/ui/cancel');

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
         }
      })
      .catch((error) => {
         logError('RankUI', 'Rank menu form failed', error);
      });
}

//Tab 1: Current Match — สถิติปัจจุบันจาก Scoreboard
function openCurrentMatch(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Current Match');

   let body = '';

   // Top Teams (Kills)
   const teamKillStats = getTeamKillStats();
   body += '§bTop Teams (Kills)\n';
   if (teamKillStats.length === 0) {
      body += '§7No data yet\n';
   } else {
      for (let i = 0; i < Math.min(teamKillStats.length, 5); i++) {
         const t = teamKillStats[i];
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : `§e#${i + 1}`;
         body += `${prefix} ${t.name} §f- §c${t.kills} Kills\n`;
      }
   }

   body += '\n';

   // Top Players (Kills)
   const playerKillStats = getPlayerKillStats();
   body += '§eTop Players (Kills)\n';
   if (playerKillStats.length === 0) {
      body += '§7No data yet\n';
   } else {
      for (let i = 0; i < Math.min(playerKillStats.length, 5); i++) {
         const p = playerKillStats[i];
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : `§e#${i + 1}`;
         const teamLabel = p.teamLabel ? ` §8[${p.teamLabel}]` : '';
         body += `${prefix} §a${p.name}${teamLabel} §f- §c${p.kills} Kills\n`;
      }
   }

   body += '\n';

   // Top Players (Deaths)
   const playerDeathStats = getPlayerDeathStats();
   body += '§cTop Players (Deaths)\n';
   if (playerDeathStats.length === 0) {
      body += '§7No data yet\n';
   } else {
      for (let i = 0; i < Math.min(playerDeathStats.length, 5); i++) {
         const p = playerDeathStats[i];
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : `§e#${i + 1}`;
         const teamLabel = p.teamLabel ? ` §8[${p.teamLabel}]` : '';
         body += `${prefix} §a${p.name}${teamLabel} §f- §4${p.deaths} Deaths\n`;
      }
   }

   form.body(body);
   form.button('Back', 'textures/ui/cancel');

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

//Tab 2: Team Placement — จัดอันดับทีม (PUBG style)
function openTeamPlacement(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Team Placement');

   const teamsSorted = getTeamsSorted();

   if (teamsSorted.length === 0) {
      form.body('§7No placement data yet.\n\nPlay matches to earn placement points!');
   } else {
      let body = '§eTeam Rankings\n§7(PUBG-style: last team = #1)\n\n';
      for (let i = 0; i < teamsSorted.length; i++) {
         const t = teamsSorted[i];
         const teamInfo = TEAM_LOOKUP.get(t.id);
         const teamColor = teamInfo ? teamInfo.color : '§f';
         const teamName = teamInfo ? teamInfo.name : t.id;
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : i === 2 ? '§e#3' : `§7#${i + 1}`;
         const firsts = t.placements['1'] || 0;
         const seconds = t.placements['2'] || 0;
         body += `${prefix} ${teamColor}${teamName} §7- §f${t.points} pts §7(#1:§f${firsts} #2:§f${seconds})\n`;
      }
      form.body(body);
   }

   form.button('Back', 'textures/ui/cancel');

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

//Tab 3: Player Survival — ผู้รอดชีวิตคนสุดท้าย
function openPlayerSurvival(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Player Survival');

   const allPlayers = getAllPlayersSorted();
   const survivors = allPlayers.filter((p) => p.survivedLast > 0);
   survivors.sort((a, b) => b.survivedLast - a.survivedLast);

   if (survivors.length === 0) {
      form.body('§7No survival data yet.\n\nBe the last survivor of your team!');
   } else {
      let body = '§e§lLast Survivors (All Time)\n\n';
      for (let i = 0; i < Math.min(survivors.length, 10); i++) {
         const p = survivors[i];
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : i === 2 ? '§e#3' : `§7#${i + 1}`;
         body += `${prefix} §a${p.name} §7- §f${p.survivedLast} Games\n`;
      }
      form.body(body);
   }

   form.button('Back', 'textures/ui/cancel');

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

//Tab 4: KDA Leaderboard — จัดอันดับ KD
function openKDABoard(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | KDA Leaderboard');

   const allPlayers = getAllPlayersSorted();
   const myData = allPlayers.find((p) => p.id === player.id);

   let body = '';

   // แสดงข้อมูลของผู้เล่นที่กดเปิด
   if (myData) {
      const tier = getRankTier(myData.kd, myData.games);
      body += `§eYour Rank: ${tier.color}${tier.name} §7(KD §f${myData.kd.toFixed(2)}§7)\n`;
      body += `Kills: §c${myData.kills} §7| Deaths: §4${myData.deaths}\n`;
      body += `Games: §f${myData.games} §7| Wins: §a${myData.wins}\n\n`;
   } else {
      body += '§eYour Rank: §7Unranked\n\n';
   }

   // Top players KD
   body += '§e§lTop Players (KD)\n';
   const ranked = allPlayers.filter((p) => p.games > 0);
   if (ranked.length === 0) {
      body += '§7No data yet\n';
   } else {
      for (let i = 0; i < Math.min(ranked.length, 10); i++) {
         const p = ranked[i];
         const tier = getRankTier(p.kd, p.games);
         const prefix = i === 0 ? '§6#1' : i === 1 ? '§f#2' : i === 2 ? '§e#3' : `§7#${i + 1}`;
         body += `${prefix} ${tier.color}${p.name} §7- KD §e${p.kd.toFixed(2)} §7(${tier.color}${tier.name}§7)\n`;
      }
   }

   form.body(body);
   form.button('Back', 'textures/ui/cancel');

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
