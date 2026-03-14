<div align="center">

# ⚔️ UHCRun Add-on

**ระบบ UHC สำหรับ Minecraft Bedrock Edition ที่เน้นประสิทธิภาพสูง**

![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock_1.21+-00AA00?style=flat-square&logo=minecraft&logoColor=white)
![API](https://img.shields.io/badge/@minecraft%2Fserver-1.26.0.2-0078D4?style=flat-square)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Players](https://img.shields.io/badge/Players-20--30-red?style=flat-square)

</div>

---

## ภาพรวม

UHCRun คือ addon ระบบ **Ultra Hardcore** ที่พัฒนาบน Minecraft Bedrock Script API  
ครอบคลุมตั้งแต่ระบบทีม, World Border แบบ dynamic, การติดตาม kill/death, ไปจนถึง NPC Leaderboard ภายใน world  
ออกแบบมาสำหรับการแข่งขันแบบ multiplayer รองรับผู้เล่น 20–30 คนต่อ session

---

## คุณสมบัติหลัก

- ⚔️ **ระบบทีม** — รองรับ 9 ทีม, เข้าร่วมผ่าน Compass menu, บันทึกข้อมูลถาวรด้วย DynamicProperty
- 🗺️ **World Border แบบ dynamic** — Shrink แบบ smooth lerp ผ่าน checkpoint (500 → 2), render particle, fog และ damage เมื่อออกนอก border
- 📊 **ระบบติดตาม Kill/Death** — เก็บสถิติรายผู้เล่นและรายทีมลง Scoreboard และ DynamicProperty
- 🏆 **NPC Leaderboard** — แสดงอันดับ Top Players, Top Teams และ Top Deaths ภายใน world
- 🔔 **ระบบ Announcer** — First Blood, Multi Kill (สูงสุด ACE), Kill Streak
- 🪓 **Plugins เสริม** — AutoSmelt, Axe mechanics, CPS counter, Enchant, Fishing HoD, Knockback
- 🎮 **Admin Panel** — UI สำหรับจัดการทีม, teleport, ดูสถิติ และ debug ข้อมูล
- ⚡ **ปรับแต่งประสิทธิภาพ** — Tick-cached player list, dirty-flag scoreboard update, grouped particle rendering

---

## ความต้องการของระบบ

- Minecraft Bedrock Edition `1.21+`
- `@minecraft/server` `1.26.0.2`
- `@minecraft/server-ui`
- Behavior Pack ที่เปิดใช้งาน Script API

---

## การติดตั้ง

```bash
git clone https://github.com/SolightzZ/uhcrun-addon.git
```

1. คัดลอกโฟลเดอร์ behavior pack ไปไว้ใน `behavior_packs/` ของ world
2. เปิดใช้งาน pack ใน **World Settings → Add-Ons → Behavior Packs**
3. เปิดใช้งาน **Beta APIs** ใน Experiments (หากเวอร์ชันต้องการ)

---

## การใช้งาน

### คำสั่ง Admin

| คำสั่ง | คำอธิบาย |
|---|---|
| `/addon:uhcsetup` | โหลด structure, ตั้งค่า gamerule, แจก kit ให้ผู้เล่นทุกคน |
| `/addon:uhcstart` | เริ่มเกม — กระจายทีม, เปิด border, เริ่ม countdown |
| `/addon:uhcreset` | Reset ทั้งหมด — ล้างทีม, สถิติ, tag และ scoreboard |
| `/addon:uhcend` | จบเกมและส่งผู้เล่นกลับ lobby |
| `/addon:tpa` | เมนู teleport สำหรับ Spectator และ Admin |

### การใช้งานภายในเกม

| การกระทำ | วิธี |
|---|---|
| เปิดเมนูหลัก | ใช้ **Compass** |
| เข้าร่วม / ออกจากทีม | Compass → Team |
| Admin panel | Compass → Admin *(ต้องมี tag `admin`)* |
| Refresh leaderboard | **Sneak + interact** กับ NPC |

---

## การตั้งค่า

แก้ไขค่าได้โดยตรงในไฟล์ source:

**`system/border.js`**
```js
const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];
const FIRST_SHRINK_DELAY = 300; // ticks ก่อน shrink ครั้งแรก
const BORDER_RENDER = { VIEW_DISTANCE: 35, PARTICLE_Y: 100 };
```

**`Manager/TeamManager.js`**
```js
const TEAMS = [ /* เพิ่ม/ลบทีมได้ที่นี่ */ ];
const CONFIG = { adminTag: "admin", comPass: "uhc" };
```

---

## โครงสร้างโปรเจกต์

```
📦 UHCRun
├── main.js                        Entry point — import ทุก module
├── system/
│   └── border.js                  World border, shrink state machine, damage, particle render
├── Manager/
│   ├── TeamManager.js             ระบบทีม, kill/death tracking, scoreboard, cache
│   ├── Leaderboard.js             NPC leaderboard rendering
│   ├── ScoreboardManager.js       Scoreboard utilities
│   └── constants.js               ข้อมูลทีมที่ใช้ร่วมกัน
├── customCommand/
│   ├── command.js                 Custom command registry
│   └── function.js                Command handlers (setup, start, reset, end)
├── plugin/
│   ├── axe.js                     Custom axe mechanics
│   ├── AutoSmelt.js               Auto-smelt เมื่อขุด
│   ├── cps.js                     CPS counter
│   ├── enchant.js                 Enchant tweaks
│   ├── fishing_hod.js             Fishing HoD mechanic
│   ├── golden_order.js            Golden order system
│   ├── Knockback.js               Custom knockback
│   └── sounds.js                  Sound events
├── utils/
│   └── nametag.js                 จัดรูปแบบ nametag
└── FormData/
    ├── CompassMenu.js             Compass UI หลัก
    └── DeathOnForm.js             Death screen UI
```

---

## สถาปัตยกรรมระบบ

```
system.runInterval (ทุก 20 ticks)
│
├── refreshPlayerCaches()          world.getPlayers() → allPlayersCache / uhcPlayersCache
│
├── WorldTick(uhcPlayers)
│   ├── eventBorders()             ตรวจ checkpoint timer → applyBorderShrink()
│   ├── updateSmoothBorder()       lerp borderRadius → syncWorldBorderGeometry()
│   ├── updateScore()              อัปเดต scoreboard เฉพาะ line ที่เปลี่ยน (dirty-flag)
│   └── BorderTick()
│       ├── handleBorderDamage()   ทุก 2 ticks — fog + applyDamage
│       └── renderBorderAABB()     ทุก 4 ticks — grouped particle spawn
│
└── PlayersTick(allPlayers)
    ├── handleGameStart()          tick 1–26 เท่านั้น
    └── displayGameStart()         action bar countdown
```

---

## Tech Stack

| เครื่องมือ | วัตถุประสงค์ |
|---|---|
| `@minecraft/server` 1.26.0.2 | Core API — entity, world, event, scoreboard |
| `@minecraft/server-ui` | ActionFormData menu |
| JavaScript (ESM) | ภาษาที่ใช้พัฒนา |
| DynamicProperty | เก็บข้อมูลทีมและสถิติแบบถาวร |
| Scoreboard | ติดตาม kill แบบ real-time และ leaderboard |

---

## สเปคเซิร์ฟเวอร์อ้างอิง

| ส่วนประกอบ | สเปค |
|---|---|
| CPU | Intel Core i5 Gen 11 |
| RAM | 16GB DDR4-3200 |
| Storage | SSD NVMe |
| จำนวนผู้เล่นที่รองรับ | 20–30 คนต่อ session |

---

## ผู้พัฒนา

**SolightzZ**  
Minecraft Bedrock Script API Developer

---

## License

MIT License — ดูรายละเอียดได้ที่ [LICENSE](LICENSE)
