import { ActionFormData } from '@minecraft/server-ui';
import { openMainMenu } from './MenuManager_Main.js';

export function Credits(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Credits');
    form.header('§eVersion');
    form.label('§7UHCRUNB26BETA04');
    form.divider();
    form.header('§eDeveloper');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eGame Design');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eEngineering');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eSound Design');
    form.label('§7SolightzZ');
    form.divider();
    form.header('§eAbout');
    form.label('§7• กระโดดเข้าสู่สนามเอาชีวิตรอด\n§7• รวมทีม วางแผน และต่อสู้\n§7• เอาชีวิตรอดให้ได้นานที่สุด\n§7• จนเหลือทีมสุดท้ายที่ยืนหยัด');
    form.header('§ePowered By');
    form.label('§7Minecraft Bedrock Script API');
    form.header('§eCredits');
    form.label('§7World Border: §fmyGenGaming\n§7Particles: §fRexoes\n§7Lobby Build: §fOMEGA BLADE\n§7Action Form: §fPablo');
    form.divider();
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Credits form failed:', err);
        });
}

export function Features(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Features');
    form.header('§eSurvival');
    form.label('§7• Max Health: §f24 HP\n§7• No natural regeneration\n§7• Heal via §fGolden Apple §7& §fCooked Beef\n§7• Grave system (§f48 slots§7)');
    form.divider();
    form.header('§eOre');
    form.label(
        '§7• Iron (→ Iron Ingot + XP)\n§7• Gold (→ Gold Ingot + XP)\n§7• Coal (→ XP)\n§7• Copper (→ XP)\n§7• Emerald (→ XP)\n§7• Lapis (→ Lapis / Book)\n§7• Gravel (→ Arrow)\n§7• Redstone (→ Heal + XP)\n§7• Diamond (→ Sound)\n§7• Obsidian (→ Sound)\n',
    );
    form.divider();
    form.header('§eCombat & PvP');
    form.label(
        '§7• PvP enabled after §f720 ticks (§712 minute§7)\n§7• Knockback system\n§7• Fishing rod mechanics\n§7• Bow hit sound + target name\n§7• CPS Limit: §f20 max\n§7• Kill & Death tracking',
    );
    form.divider();
    form.header('§eWorld Border');
    form.label('§7• Shrinks from §f500x500 → 2x2\n§7• Damage outside border\n§7• Optimized Overworld generation\n§7• Void Nether & End');
    form.divider();
    form.header('§eResources');
    form.label(
        '§7• Auto Smelt (§fOre → Ingot + XP§7)\n§7• Auto Enchant tools\n§7• Food regeneration system\n§7• Tree Capitator + Apple drops\n§7• Auto TNT\n§7• Custom loot tables\n§7• Villager trading',
    );
    form.divider();
    form.header('§eTeam & Revive');
    form.label('§7• สูงสุด §f54 §7คน (9 ทีม)\n§7• Revive using player head (§f30s§7)\n§7• Team chat & colored nametags');
    form.divider();
    form.header('§eUtilities');
    form.label('§7• Scoreboard\n§7• Interaction guard');
    form.divider();
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Features form failed:', err);
        });
}

export function Ranks(player) {
    const form = new ActionFormData();
    form.title('UHCRun26 | Features');
    form.header('Comming Soon');
    form.label('             - Sleeplite SMP - ');
    form.button('Back', 'textures/uhc/solightzz');
    form.show(player)
        .then((res) => {
            if (!res || res.canceled) return;
            openMainMenu(player);
        })
        .catch((err) => {
            console.warn('[UI_ERROR] Features form failed:', err);
        });
}
