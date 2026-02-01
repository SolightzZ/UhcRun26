// ไฟล์เก็บตัวเลขและข้อความแยกกัน อ่านง่าย แก้ที่เดียว
// Minecraft Bedrock Script API v1.21.120+ @minecraft/server v2.4.0-beta

// ========== ตัวเลข (number) ==========
export const num = {
  radiusStart: 500,
  radiusEnd: 5,
  shrinkTime: 370,
  centerX: 0,
  centerZ: 0,
  maxParticle: 50,
  nearBorder: 32,
  particleSpace: 1.6,
  tickShrinkStart: 900,
  tickShrinkEnd: 3000,
  tickBorderActive: 900,
  totalBar: 25,
  barNumStart: 25,
  countdownGameOver: 120,
  countdownStopLoop: 115,
  titleStay: 200,
  titleFadeIn: 10,
  titleFadeOut: 20,
  soundVol: 0.8,
  soundPitch: 1,
  damageOutBorder: 3,
  particleYClampMin: -64,
  particleYClampMax: 320,
  viewRange: 128,
  startTickEnd: 44,
  startBarFrom: 12,
};

// เวลา countdown ก่อน border ทำงาน — Set O(1) เช็ค
export const countSet = new Set([90, 15, 5, 4, 3, 2, 1]);

// รายการรัศมี border ที่ต้องเตือน (ใช้สร้าง Set ใหม่ตอนเริ่มเกม)
export const warnList = [450, 400, 350, 300, 250, 200, 150, 100, 50];

// ========== ข้อความ (text) ==========
export const txt = {
  borderWarn: "§cWorld Border !",
  borderWarnMsg: " World Border Warning §c",
  block: " §fBlock",
  gameOver: " Game Over §f§l\u00BB §r§f",
  noWinner: "§cNo winners found!",
  noTeam: "§cNo winning team found!",
  victory: "§g§lVictory",
  win: " Win",
  victoryHead: "\n§8----- §g+ Victory + §8------\n",
  victoryFoot: "§8----------------------\n",
  pvpOff: " : §cPVP Disabled",
  pvpOffTitle: "§cDisabled!",
  pvpOffSub: "การต่อสู้ถูก§cปิด§fแล้ว!",
  borderIn: " World Border Active in §c900§f tick",
  borderInTitle: "§l§c!",
  borderInSub: "เขตแดนเจะเริ่มทำงานในอีก 720 วินาที",
  borderActive: "§fWorld Border §aActive!",
  borderActiveSub: "เขตแดนเริ่มทำงานแล้ว!",
  pvpIn20: " §6 : PVP Enabled in 20 tick!",
  pvpIn20Title: "§6Enabled in",
  pvpIn20Sub: "จะเปิดการต่อสู้ในอีก 20 วินาที !",
  pvp3: "PVP in §c§l3 tick",
  pvp2: "PVP in §6§l2 tick",
  pvp1: "PVP in §g§l1 tick",
  pvpOn: "  : §aPVP Enabled",
  pvpOnTitle: "§a- Enabled -",
  pvpOnSub: "§fเปิดการต่อสู้แล้ว!",
  mobOff: "§cMob Spawn Disabled",
  mobOffSub: "§fปิดการเกิดม็อบแล้ว!",
  gameStart: "§fGame Start §l\u00BB ",
  goodLuck: "§fGood§aluck!",
  startLogo: "",
  objName: "uhc",
  objDisplay: "uhc",
  objBorder: " Border",
  objTick: " Tick",
};
