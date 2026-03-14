<div align="center">

# ⚔️ UHCRun Add-on

**ระบบ UHC สำหรับ Minecraft Bedrock Edition ที่เน้นประสิทธิภาพสูง**

![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock_1.26.3-00AA00?style=flat-square&logo=minecraft&logoColor=white)
![API](https://img.shields.io/badge/@minecraft%2Fserver-1.26.0.2-0078D4?style=flat-square)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Players](https://img.shields.io/badge/Players-20--30-red?style=flat-square)
![GitHub Stars](https://img.shields.io/github/stars/SolightzZ/UhcRun26?style=flat-square&logo=github)
![Last Commit](https://img.shields.io/github/last-commit/SolightzZ/UhcRun26?style=flat-square)
![Version](https://img.shields.io/badge/Version-beta_0.1-orange?style=flat-square)

</div>

---

## ภาพรวม

UHCRun คือส่วนเสริม (Add-on) ระบบ **Ultra Hardcore** ที่พัฒนาบน Minecraft Bedrock Script API  
ครอบคลุมตั้งแต่ระบบทีม, World Border แบบไดนามิก, การติดตามสถิติการสังหาร/เสียชีวิต ไปจนถึง NPC Leaderboard ภายในโลก  
ออกแบบมาสำหรับการแข่งขันแบบผู้เล่นหลายคน รองรับผู้เล่น 20–30 คนต่อเซสชัน

---

## คุณสมบัติหลัก

- ⚔️ **ระบบทีม** — รองรับ 9 ทีม, เข้าร่วมผ่านเมนู Compass, บันทึกข้อมูลถาวรด้วย DynamicProperty
- 🗺️ **World Border แบบไดนามิก** — หดตัวแบบ Smooth Lerp ผ่านจุดตรวจสอบ (500 → 2), แสดงอนุภาค, หมอก และความเสียหายเมื่อออกนอกขอบเขต
- 📊 **ระบบติดตามสถิติ** — เก็บสถิติการสังหารและการเสียชีวิตรายผู้เล่นและรายทีมลง Scoreboard และ DynamicProperty
- 🏆 **NPC Leaderboard** — แสดงอันดับผู้เล่นยอดเยี่ยม, ทีมยอดเยี่ยม และผู้เสียชีวิตสูงสุดภายในโลก
- 🔔 **ระบบประกาศ** — First Blood, Multi Kill (สูงสุด ACE), Kill Streak
- 🪓 **ปลั๊กอินเสริม** — AutoSmelt, กลไกขวาน, ตรวจจับ CPS, Enchant, Fishing HoD, Knockback
- 🎮 **แผงควบคุมผู้ดูแล** — อินเทอร์เฟซสำหรับจัดการทีม, เทเลพอร์ต, ดูสถิติ และตรวจสอบข้อมูล
- ⚡ **การปรับแต่งประสิทธิภาพ** — Tick-cached player list, Dirty-flag scoreboard update, Grouped particle rendering

---

## ความต้องการของระบบ

- Minecraft Bedrock Edition `1.26.3`
- `@minecraft/server` `1.26.0.2`
- `@minecraft/server-ui`
- Behavior Pack ที่เปิดใช้งาน Script API

---

## การติดตั้ง

```bash
git clone https://github.com/SolightzZ/UhcRun26.git
```

1. คัดลอกโฟลเดอร์ Behavior Pack ไปไว้ใน `behavior_packs/` ของโลก
2. เปิดใช้งาน Pack ใน **World Settings → Add-Ons → Behavior Packs**
3. เปิดใช้งาน **Beta APIs** ใน Experiments (หากเวอร์ชันต้องการ)

---

## การใช้งาน

### คำสั่งผู้ดูแลระบบ

| คำสั่ง | คำอธิบาย |
|---|---|
| `/addon:uhcsetup` | โหลด Structure, ตั้งค่า Gamerule, แจก Kit ให้ผู้เล่นทุกคน |
| `/addon:uhcstart` | เริ่มเกม — กระจายทีม, เปิด Border, เริ่มนับถอยหลัง |
| `/addon:uhcreset` | รีเซ็ตทั้งหมด — ล้างทีม, สถิติ, Tag และ Scoreboard |
| `/addon:uhcend` | จบเกมและส่งผู้เล่นกลับล็อบบี้ |
| `/addon:tpa` | เมนูเทเลพอร์ตสำหรับ Spectator และผู้ดูแลระบบ |

### การใช้งานภายในเกม

| การกระทำ | วิธีการ |
|---|---|
| เปิดเมนูหลัก | ใช้ **Compass** |
| เข้าร่วม / ออกจากทีม | Compass → Team |
| แผงควบคุมผู้ดูแล | Compass → Admin *(ต้องมี Tag `admin`)* |
| รีเฟรช Leaderboard | **Sneak + Interact** กับ NPC |

---

## การตั้งค่า

แก้ไขค่าได้โดยตรงในไฟล์ Source:

**`system/border.js`**
```js
const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];
const FIRST_SHRINK_DELAY = 300; // ticks ก่อนการหดตัวครั้งแรก
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
├── main.js                        Entry Point — นำเข้าทุกโมดูล
├── system/
│   └── border.js                  World Border, State Machine การหดตัว, ความเสียหาย, การแสดงอนุภาค
├── Manager/
│   ├── TeamManager.js             ระบบทีม, ติดตามสถิติ, Scoreboard, Cache
│   └── Leaderboard.js             การแสดงผล NPC Leaderboard
├── customCommand/
│   ├── command.js                 ทะเบียนคำสั่งกำหนดเอง
│   └── function.js                ตัวจัดการคำสั่ง (Setup, Start, Reset, End)
└── plugin/
    ├── axe.js                     กลไกขวานกำหนดเอง
    ├── AutoSmelt.js               หลอมอัตโนมัติเมื่อขุด
    ├── anticheat_cps.js           ตรวจจับการโกง CPS
    ├── blockInteractGuard.js      ป้องกันการโต้ตอบกับบล็อก
    ├── enchant.js                 ปรับแต่ง Enchant
    ├── fishing_hod.js             กลไก Fishing HoD
    ├── Knockback.js               Knockback กำหนดเอง
    ├── plateKnockback.js          Knockback จาก Pressure Plate
    ├── projectile_hit_souns.js    เสียงเมื่อถูกกระสุน
    ├── tnt_instant.js             TNT จุดระเบิดทันที
    └── Util.js                    ฟังก์ชันอรรถประโยชน์
```

---

## สถาปัตยกรรมระบบ

```
system.runInterval (ทุก 20 Ticks)
│
├── refreshPlayerCaches()          world.getPlayers() → allPlayersCache / uhcPlayersCache
│
├── WorldTick(uhcPlayers)
│   ├── eventBorders()             ตรวจสอบตัวจับเวลา Checkpoint → applyBorderShrink()
│   ├── updateSmoothBorder()       Lerp borderRadius → syncWorldBorderGeometry()
│   ├── updateScore()              อัปเดต Scoreboard เฉพาะบรรทัดที่เปลี่ยนแปลง (Dirty-flag)
│   └── BorderTick()
│       ├── handleBorderDamage()   ทุก 2 Ticks — หมอก + ความเสียหาย
│       └── renderBorderAABB()     ทุก 4 Ticks — สร้างอนุภาคแบบกลุ่ม
│
└── PlayersTick(allPlayers)
    ├── handleGameStart()          Tick 1–26 เท่านั้น
    └── displayGameStart()         แสดงนับถอยหลังบน Action Bar
```

---

## Tech Stack

| เครื่องมือ | วัตถุประสงค์ |
|---|---|
| `@minecraft/server` 1.26.0.2 | Core API — Entity, World, Event, Scoreboard |
| `@minecraft/server-ui` | ActionFormData Menu |
| JavaScript (ESM) | ภาษาที่ใช้ในการพัฒนา |
| DynamicProperty | จัดเก็บข้อมูลทีมและสถิติแบบถาวร |
| Scoreboard | ติดตามการสังหารแบบ Real-time และ Leaderboard |

---

## สเปคเซิร์ฟเวอร์อ้างอิง

| ส่วนประกอบ | สเปค |
|---|---|
| CPU | Intel Core i5 Gen 11 |
| RAM | 16GB DDR4-3200 |
| Storage | SSD NVMe |
| จำนวนผู้เล่นที่รองรับ | 20–30 คนต่อเซสชัน |

---

## สเปคเครื่องผู้พัฒนา

| ส่วนประกอบ | สเปค |
|---|---|
| CPU | Intel Core i5-13420H |
| RAM | 32GB DDR5-5200 |
| Storage | SSD NVMe Samsung 512GB |
| GPU | NVIDIA GeForce RTX 4050 Laptop GPU |

---

## ขั้นตอนการเล่น

```
1. ติดตั้ง     /addon:uhcsetup  →  โหลด Structure + แจก Kit + ตั้งค่า Gamerule
2. ล็อบบี้     ผู้เล่นเลือกทีมผ่าน Compass → Team
3. เริ่มเกม    /addon:uhcstart  →  กระจายทีม + เปิด World Border (500 บล็อก)
4. หดตัว      Border หดผ่านจุดตรวจสอบอัตโนมัติ (500 → 2) แบบ Smooth Lerp
5. ต่อสู้      ระบบสถิติ, ระบบประกาศ, Leaderboard ทำงานแบบ Real-time
6. จบเกม      /addon:uhcend    →  ประกาศผู้ชนะ + ส่งผู้เล่นกลับล็อบบี้
7. รีเซ็ต      /addon:uhcreset  →  ล้างข้อมูลทั้งหมดเพื่อเริ่มรอบใหม่
```

---

## ข้อจำกัดที่ทราบ

- จำเป็นต้องเปิดใช้งาน **Beta APIs** ใน Experiments — เป็นข้อกำหนดของ Script API
- NPC Leaderboard ต้องรีเฟรชด้วยตนเอง (Sneak + Interact) ไม่รองรับการอัปเดตแบบ Real-time
- Script API ของ Bedrock ไม่รองรับการจัดเก็บข้อมูลถาวรนอกจาก DynamicProperty — ข้อมูลอาจสูญหายหาก Pack ถูกโหลดใหม่ระหว่างเกม
- รองรับสูงสุด 9 ทีม ตามข้อจำกัดของอินเทอร์เฟซและการออกแบบ Scoreboard

---

## บันทึกการเปลี่ยนแปลง

### v0.1.0-beta — เวอร์ชันทดสอบเบื้องต้น
- ระบบทีม 9 ทีม พร้อมเมนู Compass
- World Border แบบไดนามิกหดตัวผ่านจุดตรวจสอบ
- ติดตามสถิติการสังหาร/เสียชีวิตลง Scoreboard และ DynamicProperty
- NPC Leaderboard (ผู้เล่นยอดเยี่ยม, ทีมยอดเยี่ยม, ผู้เสียชีวิตสูงสุด)
- ระบบประกาศ: First Blood, Multi Kill, Kill Streak
- ชุดปลั๊กอิน: AutoSmelt, Axe, CPS Anticheat, Enchant, Fishing HoD, Knockback, TNT Instant
- แผงควบคุมผู้ดูแลผ่าน Compass

---

## การมีส่วนร่วม

โปรเจกต์นี้เปิดรับข้อเสนอแนะและรายงานข้อผิดพลาดผ่าน [GitHub Issues](https://github.com/SolightzZ/UhcRun26/issues)  
หากพบปัญหาหรือต้องการเสนอฟีเจอร์ใหม่ สามารถเปิด Issue ได้เลย

---

## ผู้พัฒนา

**SolightzZ**  
Minecraft Bedrock Script API Developer

---

## สัญญาอนุญาต

MIT License — ดูรายละเอียดได้ที่ [LICENSE](LICENSE)
