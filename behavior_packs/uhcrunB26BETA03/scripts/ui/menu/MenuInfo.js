import { ActionFormData } from '@minecraft/server-ui';
import { logError } from '../../shared/Util.js';
import { go, setNav } from '../MenuRouter.js';

export function Credits(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Credits');
   form.header('§eVersion');
   form.label('§726BETA05');
   form.divider();
   form.header('§eDeveloper');
   form.label('§7SolightzZ');
   form.divider();
   form.header('§eGame Design');
   form.label('§7SolightzZ');
   form.divider();
   form.header('§eSound Design');
   form.label('§7SolightzZ');
   form.divider();
   form.header('§eAbout');
   form.label('§7• Survive. Fight. Win.\n§7• Stand strong until the end.\n§7• Last team standing wins.');
   form.divider();
   form.header('§ePowered By');
   form.label('§7Minecraft Bedrock Script API');
   form.divider();
   form.header('§eSpecial Thanks');
   form.label('§7World Border: §fmyGenGaming\n§7Particles: §fRexoes\n§7Lobby Build: §fOMEGA BLADE\n§7Action Form: §fPablo');
   form.divider();
   form.label('                  - Sleeplite - ');
   form.button('Back', 'textures/uhc/solightzz');
   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         go(player, 'main');
      })
      .catch((error) => {
         logError('UI_ERROR', 'Credits form failed', error);
      });
}

export function Features(player) {
   const form = new ActionFormData();
   form.title('UHCRun26 | Features');
   form.header('§eSurvival');
   form.label('§7• §f40 Max Health (20 Hearts)\n§7• No natural healing\n§7• Cooked food heals you\n§7• Golden Apple & Redstone heal you\n§7• Teammates drop head on death');
   form.divider();
   form.header('§eOre');
   form.label(
      '§7• Iron/Gold → Auto-smelt + XP\n§7• Coal/Copper/Emerald → XP\n§7• Lapis → Lapis + Book (random)\n§7• Gravel → Arrow (random)\n§7• Redstone → Heal + Shield (random)\n§7• Diamond/Obsidian → Fast mining (random)',
   );
   form.divider();
   form.header('§eCombat');
   form.label('§7• Better knockback (KB)\n§7• Fishing rod knockback\n§7• Bow Ding\n§7• Pressure plates launch you high');
   form.divider();
   form.header('§ePvP & Anticheat');
   form.label('§7• PvP starts at 12 minutes\n§7• Click speed limit (Anti-Autoclick)\n§7• Multi-kill alerts\n§7• First kill alert');
   form.divider();
   form.header('§eWorld Border');
   form.label('§7• Border shrinks (500 to 2)\n§7• Damage outside border\n§7• Shrinks in 16 steps\n§7• Ground fills at final fight');
   form.divider();
   form.header('§eResources');
   form.label('§7• Auto-smelt ores\n§7• Faster mining tools\n§7• Chop whole tree in one hit\n§7• Instant TNT explosion\n§7• Items fly to you (Vacuum)');
   form.divider();
   form.header('§eDeath & Loot');
   form.label('§7• Show killer name on death\n§7• No item drops on death (deleted)\n§7• Track kills and deaths\n§7• Stats saved every game');
   form.divider();
   form.header('§eTeam & Revive');
   form.label('§7• Up to 54 players (9 teams)\n§7• Revive teammates in 8s\n§7• Revive cooldown is 18s\n§7• Team name colors');
   form.divider();
   form.header('§eEnd Game');
   form.label('§7• Last team alive wins\n§7• Draw if everyone dies\n§7• Final arena fills with land\n§7• Show match stats at end');
   form.divider();
   form.header('§eSystems');
   form.label('§7• Scoreboard on screen\n§7• Rank levels (Bronze to Master)\n§7• Leaderboard NPCs in lobby\n§7• Block interactive containers');
   form.divider();
   form.label('                  - Sleeplite - ');
   form.button('Back', 'textures/uhc/solightzz');
   form
      .show(player)
      .then((res) => {
         if (!res || res.canceled) return;
         go(player, 'main');
      })
      .catch((error) => {
         logError('UI_ERROR', 'Features form failed', error);
      });
}

export function Ranks(player) {
   go(player, 'rank');
}

setNav('credits', Credits);
setNav('features', Features);
setNav('ranks', Ranks);
