<p align="center">
  <img src="resource_packs/uhcrunR26BETA04/textures/ui/title.png" alt="UHCRun Logo" width="600">
</p>

<h1 align="center">⚔️ UHCRun</h1>

<p align="center">
  <b>Ultra Hardcore</b> — Minecraft Bedrock Edition addon for Bedrock Dedicated Server
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-B26BETA04-red?style=for-the-badge&labelColor=1a1a2e" alt="Version">
  <img src="https://img.shields.io/badge/API-%40minecraft%2Fserver%202.9.0--beta-blue?style=for-the-badge&labelColor=1a1a2e" alt="API">
  <img src="https://img.shields.io/badge/Engine-1.26.30%2B-brightgreen?style=for-the-badge&labelColor=1a1a2e" alt="Engine">
  <img src="https://img.shields.io/badge/Scripts-106%20files%20%E2%80%A2%20~7%2C800%20lines-orange?style=for-the-badge&labelColor=1a1a2e" alt="Scripts">
  <img src="https://img.shields.io/badge/Players-54%20cap-ff69b4?style=for-the-badge&labelColor=1a1a2e" alt="Players">
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge&labelColor=1a1a2e" alt="License">
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Commands](#-commands)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Pack Layout](#-pack-layout)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Player Capacity](#-player-capacity)
- [API Dependencies](#-api-dependencies)
- [UUID Reference](#-uuid-reference)
- [Development](#-development)

---

## 🎯 Overview

UHCRun is a full-featured **Ultra Hardcore** (UHC) addon for Minecraft Bedrock. It provides a complete game loop — setup, team management, border shrink, PvP enhancements, death tracking, revives, leaderboards, and an end sequence — all running as **ES modules** on BDS **without any build tooling**.

| Aspect | Details |
|--------|---------|
| 📦 **Type** | Behavior Pack + Resource Pack |
| 🧩 **Scripts** | 106 files · ~7,800 lines |
| 🔧 **Runtime** | ES modules · no build step |
| 🎮 **Players** | Up to 54 (9 teams × 6) |
| 🌐 **Discord** | [Join the community](https://discord.gg/gtqfbmvTJK) |

---

## ⚡ Features

### 🎮 Game Systems

| Feature | Description |
|---------|-------------|
| **Border** | 16-stage shrink (500×500 → 2×2) with particle rendering, damage scaling (max 5 HP), warning sounds, and multi-phase end sequence |
| **Match Lifecycle** | `setup → scatter → game loop (PVP @ tick 720, border tick, victory check) → end → reset` |
| **Victory/Draw** | Checks every 60 ticks; single team remaining triggers 10s countdown win |
| **End Sequence** | Nether wall build (ancient debris/magma/blackstone) → ring-clearing patterns centered at (0,0) |

### 👥 Teams

| Feature | Description |
|---------|-------------|
| **9 Teams** | Red, Blue, Yellow, Green, Purple, Aqua, Orange, Gray, Pink |
| **Hard Cap** | 54 total players, enforced at join time via `joinTeam()` and UI |
| **Nametags** | Colored `[index]` prefix per team |
| **GUI Manager** | Join/leave teams, admin panel (11 options), teleport, player status, cache inspector |
| **Scoreboard** | Real-time sidebar with alive teams, border status, game state |

### ⚔️ PvP & Combat

| Feature | Description |
|---------|-------------|
| **Custom Knockback** | Horizontal 0.18 (clamped ±1.2), vertical 0.32, 2-tick throttle |
| **Fishing Rod KB** | Horizontal 1.25, vertical 0.38, hook removed on hit |
| **Pressure Plate** | Crimson plates launch in view direction (h: 0.35, v: 1.2) |
| **CPS Anti-Cheat** | 24-entry circular buffer, 20-tick window, kicks at 24+ CPS |
| **Projectile Sounds** | Orb sound to shooter on arrow/trident/snowball/egg hit |

### ⛏️ Progression

| Feature | Description |
|---------|-------------|
| **Auto-Smelt** | Iron/gold → ingot + XP; coal/copper/emerald → XP; lapis → book (12%); gravel → arrows; redstone → heal 2 HP |
| **Auto-Enchant** | Efficiency IV on pickaxes/shovels (3-tick throttle, lore-checked) |
| **Tree Capitator** | Queue-based felling (max 16 logs, 64 leaves, 400 scan cap, 4 concurrent jobs) |
| **Food Regen** | Regeneration II for 10s on cooked food |
| **Instant TNT** | Place-and-primed, per-player cooldown (2 ticks), global cap (8/tick) |

### 💀 Revive & Death

| Feature | Description |
|---------|-------------|
| **Player Head Revive** | 8s channel (160 ticks), 18s cooldown, cancel on move >1 block / dimension switch / item loss / team change |
| **Death Tracking** | K/D stats, kill streaks, multi-kill announcements (Double → Triple → Quadra → Ace), first blood |
| **Item Vacuum** | Hopper minecart collection, queue-bounded (32 jobs, 3-tick drain) |
| **Death UI** | Title/subtitle screen with killer info, stats, environment cause |

### 🌍 World & Interaction

| Feature | Description |
|---------|-------------|
| **Block Breaking** | Unrestricted within ±500 world border |
| **Block Placing** | Restricted by ±500 global limit + end-sequence lock (radius ≤ 16) |
| **Interaction Guard** | Denylist: cartography table, brewing stand, furnaces, grindstone, smithing table, shulker boxes, hoppers, barrels, composters; ender chest → knockback |
| **Leaderboard NPCs** | 3 NPCs displaying top 10 kills, deaths, and teams (hash-validated cache) |

---

## 🎮 Commands

All commands registered via `customCommandRegistry.registerCommand()`. Admin commands require the `GameDirectors` tag.

| Command | Permission | Description |
|---------|-----------|-------------|
| **`addon:uhcsetup`** | `GameDirectors` | Load structure, create ticking areas (9+1), set gamerules, spawn NPCs |
| **`addon:uhcstart`** | `GameDirectors` | Init match — scatter teleport, game loop, border start |
| **`addon:uhcend`** | `GameDirectors` | Stop match — cleanup, victory message, restore gamerules |
| **`addon:uhcreset`** | `GameDirectors` | Full reset — clear tags, dynprops, caches, stats, NPCs |
| **`addon:tpa`** | `Any` | Teleport menu — TP to UHC players (admin: choose target / spectator: random TP / UHC: blocked) |
| **`addon:gui`** | `GameDirectors` | Main admin GUI (spawn, team, features, credits, ranks, admin) |
| **`addon:profiler`** | `GameDirectors` | Toggle tick-budget profiler (reports every 30s via console) |
| **`addon:check`** | `GameDirectors` | Check current sizes of UHC runtime caches |
| **`addon:clear`** | `GameDirectors` | Clear match runtime caches (keeps lifetime stats) |
| **`addon:clearall`** | `GameDirectors` | Clear all caches including player/team stats |

---

## 🏗️ Architecture

### Layer Overview

```
main.js ── Entry (imports 20 event files as side-effect modules)
│
├── 📡 events/ (20 files) ── subscribes to Minecraft events
│   ├── system-startup.js              Custom command registration
│   ├── system-runInterval.js          Periodic cleanup (100/200 ticks)
│   ├── world-playerSpawn.js           Player join, team restore, spectator
│   ├── world-playerLeave.js           Cache purge, revive cancel
│   ├── world-entityDie.js             Death processing pipeline
│   ├── world-entityHurt.js            Hit registry + knockback
│   ├── world-entityHitEntity.js        CPS detection
│   ├── world-entityItemPickup.js       Auto-smelt item transform
│   ├── world-entitySpawn.js           Hopper minecart removal
│   ├── world-itemUse.js               Revive + compass menu
│   ├── world-itemCompleteUse.js       Food consumption effects
│   ├── world-playerBreakBlock.js       Border guard (before)
│   ├── world-playerBreakBlockAfter.js  Auto-smelt + tree capitator
│   ├── world-playerPlaceBlock.js       Border guard (before)
│   ├── world-playerPlaceBlockAfter.js  Instant TNT
│   ├── world-playerInteractWithBlock.js Border guard + interaction guard
│   ├── world-playerInteractWithEntity.js Border guard + NPC cancel
│   ├── world-playerHotbarSelectedSlotChange.js Auto-enchant
│   ├── world-projectileHitEntity.js    Fishing rod KB + hit sounds
│   └── world-pressurePlatePush.js      Pressure plate launch
│
├── ⌨️ commands/ (7 files) ── custom slash command handlers
│   ├── function.js        CommandMap + registration
│   ├── uhc-commands.js    setup, start, end, reset
│   ├── tpa.js             Teleport menu
│   ├── cache-commands.js  check, clear, clearall
│   ├── lifecycle.js       Operation mutex lock
│   ├── confirm-action.js  MessageForm confirmation helper
│   └── player-util.js     batch, cmd, player pipelines
│
├── 🧠 features/ (9 subdirs, 37 files) ── core game logic
│   ├── border/        6 files ── Shrink, particles, damage, scoreboard
│   ├── block-filler/  7 files ── Async fill queue, patterns, end sequence
│   ├── cache/         3 files ── Player caches, item vacuum, GC
│   ├── leaderboard/   3 files ── 3 NPCs: kills, deaths, teams
│   ├── match/         5 files ── Lifecycle, 2-phase scatter, victory
│   ├── rank/          2 files ── Cross-match persistence, tiers
│   ├── revive/        4 files ── Player head revive (8s channel)
│   ├── stats/         3 files ── Death, scoreboard, announcer
│   └── team/          4 files ── CRUD, state, teleport
│
├── 🔌 plugin/ (12 components × 3 files = 36 files) ── MVC pattern
│   ├── anticheat-cps/         CPS detection (24 entry buffer, kick at 24)
│   ├── auto-smelt/            Ore → ingot + XP, lucky lapis
│   ├── axe/                   Tree capitator (BFS, max 16 logs)
│   ├── block-interact-guard/  Denylist + ender chest KB
│   ├── enchant/               Efficiency IV on pick/shovel
│   ├── fishing-hod/           Fishing rod PvP knockback
│   ├── item-consume-effects/  Food regen II
│   ├── item-pickup/           Auto-smelt pickup transform
│   ├── knockback/             Custom KB (h: 0.18, v: 0.32)
│   ├── plate-knockback/       Crimson plate launch
│   ├── projectile-hit-sounds/ Orb sound on projectile hit
│   └── tnt-instant/           Place-and-primed TNT
│
├── 🛠️ shared/ (8 files) ── utilities
│   ├── Util.js            Gamemode, KB, logging, dynamicToast, loc pool
│   ├── TickProfiler.js    wrapTick profiler (30s reports)
│   ├── LRUMap.js          LRU cache with TTL
│   ├── VectorPool.js      {x, y, z} pool (size 500)
│   ├── State_Queue.js     Item vacuum + death queue state
│   └── profiler/          5 files ── state, TPS, reporter, wrapper
│
└── 🖥️ ui/ (7 files) ── ActionFormData menus
    ├── menu/     MainMenu, AdminMenu, Teleport, Info
    ├── rank/     RankUI (4 tabs)
    ├── revive/   ReviveUI (dead teammate picker)
    └── team/     TeamActionsUI (9 team selector)
```

### Event Wiring

Each `events/world-*.js` subscribes to one Minecraft event and delegates through `runEventHandlers()`:

```js
import { world } from '@minecraft/server';
import autoSmelt from '../plugin/auto-smelt/Controller.js';
import axe from '../plugin/axe/Controller.js';
import { runEventHandlers } from '../shared/Util.js';

const afterEvents = [(ev) => autoSmelt.onPlayerBreakBlock(ev), (ev) => axe.onPlayerBreakBlock(ev)];

world.afterEvents.playerBreakBlock.subscribe((event) => {
   runEventHandlers('BreakBlockAfter', afterEvents, event);
});
```

Each handler is individually **try/caught** — one failure never blocks others.

### Event → Plugin Wiring Table

| Event File | Phase | Delegates To |
|-----------|-------|-------------|
| `world-playerBreakBlock.js` | `beforeEvents` | border guard |
| `world-playerBreakBlockAfter.js` | `afterEvents` | auto-smelt, axe |
| `world-playerPlaceBlock.js` | `beforeEvents` | border guard |
| `world-playerPlaceBlockAfter.js` | `afterEvents` | tnt-instant |
| `world-entityHurt.js` | `afterEvents` | knockback |
| `world-entityHitEntity.js` | `afterEvents` | anticheat-cps |
| `world-entityItemPickup.js` | `afterEvents` | item-pickup |
| `world-entitySpawn.js` | `afterEvents` | block-interact-guard |
| `world-itemCompleteUse.js` | `afterEvents` | item-consume-effects |
| `world-projectileHitEntity.js` | `afterEvents` | fishing-hod, projectile-hit-sounds |
| `world-playerHotbarSelectedSlotChange.js` | `afterEvents` | enchant |
| `world-playerInteractWithBlock.js` | `beforeEvents` | border guard, block-interact-guard |
| `world-playerLeave.js` | `afterEvents` | anticheat-cps, auto-smelt, axe, enchant, knockback, tnt-instant |

### Plugin Architecture (MVC)

All 12 plugins follow a consistent MVC pattern:

```
plugin/<name>/
├── Controller.js   Event handlers — orchestrates Model + Service
├── Model.js        Config constants, state maps, cooldowns
└── Service.js      Business logic, side effects
```

### Match Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│  addon:uhcsetup                                         │
│  ├─ Load uhc1.mcstructure                               │
│  ├─ Create 10 ticking areas (9 zones + far north)       │
│  ├─ Set gamerules (peaceful, no PVP, no natural regen)  │
│  ├─ Batch player pipeline: compass → spawn → effects    │
│  └─ Spawn 3 leaderboard NPCs                            │
├─────────────────────────────────────────────────────────┤
│  addon:uhcstart                                          │
│  └─ startGameUhc()                                      │
│      ├─ borderManagerInit: shrink timer + scoreboard    │
│      ├─ scatter: Phase 1 (leaders Y=200 → preload)     │
│      │           Phase 2 (members → safe Y)             │
│      ├─ PVP timer: warning @ tick 700, enable @ 720    │
│      └─ game loop start (20-tick interval)              │
├─────────────────────────────────────────────────────────┤
│  [Game Loop]                                            │
│  ├─ tick++ → border tick → shrink → checkpoint         │
│  ├─ particle rendering (every 4 ticks)                  │
│  ├─ victory check (every 60 ticks)                      │
│  └─ player effects + sounds (first 26 ticks)            │
├─────────────────────────────────────────────────────────┤
│  [Player Death]                                         │
│  ├─ Cancel revive session                               │
│  ├─ Remove from alive tracking                          │
│  ├─ Particles → spectator + drop head + vacuum items   │
│  ├─ Update stats → killer rewards                       │
│  └─ Queue death UI (batched 5-10/tick)                  │
├─────────────────────────────────────────────────────────┤
│  addon:uhcend                                           │
│  ├─ Stop game loop                                      │
│  ├─ Victory message + particles                         │
│  ├─ Clear player states                                 │
│  └─ Restore gamerules                                   │
├─────────────────────────────────────────────────────────┤
│  addon:uhcreset                                         │
│  ├─ clearAllTaguhcAndDynamicProperty                    │
│  ├─ clearAllCachesIncludingStats                        │
│  ├─ Reset border state                                  │
│  └─ Respawn NPCs                                        │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Configuration

| Constant | File | Default | Description |
|----------|------|---------|-------------|
| `CONFIG.maxTotalPlayers` | `constants/game.js` | `54` | Hard total player cap |
| `TEAMS` | `constants/game.js` | 9 teams | Team pool (id, name, color, icon) |
| `CHECKPOINTS` | `features/border/BorderManager.js` | `[500, 450, …, 2]` | 16 border shrink stages |
| `MAX_SPAWN_RADIUS` | `features/match/MatchTeleport.js` | `490` | Max scatter radius |
| `GROUPS_RENDER_CAP` | `features/border/BorderParticle.js` | `36` | Particle groups rendered per tick |
| `GROUPS_POOL_CAP` | `features/border/BorderParticle.js` | `54` | Max particle group pool |
| `ITEM_VACUUM_MAX_QUEUE` | `features/cache/ItemVacuum.js` | `32` | Item vacuum queue limit |
| `PVP_TICK` | `features/match/MatchManager.js` | `720` | PVP enable tick (36s) |
| `PLACE_BLOCK_LOCK_RADIUS` | `features/border/BorderGuard.js` | `16` | Placing disabled when border ≤ this |
| `MAX_LOGS` | `plugin/axe/Model.js` | `16` | Logs per tree capitator scan |
| `MAX_LEAVES` | `plugin/axe/Model.js` | `64` | Leaves per tree capitator scan |
| `HARD_LIMIT` | `plugin/anticheat-cps/Model.js` | `24` | CPS kick threshold |
| `MAX_CPS` | `plugin/anticheat-cps/Model.js` | `20` | Legitimate CPS limit |

> 📖 See [`constants/game.js`](behavior_packs/uhcrunB26BETA03/scripts/constants/game.js) for all configuration defaults.

---

## 📂 Pack Layout

```
<world>/
├── 📦 behavior_packs/
│   └── uhcrunB26BETA03/        (BP · uuid c336df36-…)
│       ├── scripts/
│       │   ├── main.js                     Entry — imports 20 event files
│       │   ├── commands/                   7 files — custom slash commands
│       │   ├── constants/                  2 files — game config + leaderboard
│       │   ├── events/                     20 files — event subscriptions
│       │   ├── features/                   9 subdirs, 37 files — core game logic
│       │   ├── plugin/                     12 MVC components, 36 files
│       │   ├── shared/                     8 files — utilities, profiler, LRU
│       │   └── ui/                         7 files — ActionForm menus
│       ├── entities/                       8 files
│       ├── loot_tables/                    60+ files — chests, entities, equipment
│       ├── structures/                     uhc1 + uhc.mcstructure
│       ├── features/ + feature_rules/      135+ JSON files
│       ├── recipes/ + trading/             27 files
│       └── manifest.json
│
└── 🎨 resource_packs/
    └── uhcrunR26BETA04/        (RP · uuid 08b80ad8-…)
        ├── animations/                     shield.animation.json
        ├── custom_textures/                4 JSON texture definitions
        ├── particles/                      20 particle JSON files
        ├── sounds/
        │   ├── kill/                       k1-k5.ogg
        │   ├── 2025/                       go.ogg, spawns.ogg, win.ogg
        │   └── uhc/                        noti.ogg, player.ogg, spawn.ogg …
        ├── texts/                          en_US.lang, en_GB.lang
        └── ui/                             10 UI JSON files
```

---

## 📥 Installation

1. **Deploy packs** — Copy `behavior_packs/uhcrunB26BETA03/` and `resource_packs/uhcrunR26BETA04/` into your BDS `worlds/<world-name>/` directory
2. **Activate** — Ensure `world_behavior_packs.json` and `world_resource_packs.json` reference the correct UUIDs
3. **Start server** — BDS loads and registers all scripts on startup
4. **First run** — Use `addon:uhcsetup` to prepare the world

> ⚠️ **Important:** BDS caches ES modules in memory. `/reload` may not pick up script changes. A **full server restart** is required after editing `.js` files.

---

## 🚀 Quick Start

```bash
# 1. Admin sets up the world
addon:uhcsetup
# → Structure loaded, ticking areas active, gamerules set, NPCs spawned

# 2. Players join teams — right-click Compass (slot 1) in hand
# → Main Menu → select "Team" → pick a team color
# → UI shows live count: "ผู้เล่นทั้งหมด: 12/54"

# 3. Admin starts the game
addon:uhcstart
# → 2-phase scatter teleport (leader at Y=200 → members at safe Y)
# → Border shrink timer begins (500 → 450 at tick 300)
# → PvP enables at tick 720 (36 seconds)

# 4. Game plays out
# → Border shrinks through 16 checkpoints
# → Deaths tracked, player heads dropped for revive
# → Victory triggers when 1 team remains

# 5. Admin ends or resets
addon:uhcend    # Stop match, show results
addon:uhcreset  # Full wipe for next game
```

---

## 👥 Player Capacity

| Players | Configuration | Rating |
|---------|--------------|--------|
| **9** | Solo (1 per team) | ✅ Optimal |
| **18** | To2 (2 per team) | ✅ Optimal |
| **27** | To3 (3 per team) | ✅ Optimal |
| **36** | To4 (4 per team) | ⚠️ Manageable |
| **45** | To5 (5 per team) | ⚠️ Manageable |
| **54** | To6 (6 per team) | 🔷 Hard cap (code-enforced) |

**Typical usage:** 12–20 players (4–5 teams × 3–4 players) — all systems run at full efficiency.  
**Scatter:** 9 spread points at radius 490 (≈342 blocks apart). Team members share XZ position.

---

## 📦 API Dependencies

| Package | Version |
|---------|---------|
| `@minecraft/server` | `2.9.0-beta` |
| `@minecraft/server-ui` | `2.2.0-beta` |
| `@minecraft/server-gametest` | `1.0.0-beta` |
| `@minecraft/server-admin` | `1.0.0-beta` |

---

## 🔑 UUID Reference

| Pack | UUID | Type |
|------|------|------|
| **Behavior Pack** | `c336df36-6023-4f77-8dce-9ff86ef835b3` | data + scripts |
| **Resource Pack** | `08b80ad8-636f-4fe9-b318-62e61770812a` | resources |

---

## 🛠️ Development

- **Edit → test** — No build step. Edit `.js`/`.json` directly, restart BDS.
- **No CI/CD** — No linter, formatter, typechecker, or test framework.
- **Version control** — `.gitignore` skips: `level.dat`, `level.dat_old`, `db/`, `levelname.txt`

---

<p align="center">
  <sub>
    Built with ❤️ for Minecraft Bedrock Edition<br>
    <a href="https://discord.gg/gtqfbmvTJK">Join the Sleeplite Community</a>
  </sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/UHCRun-B26BETA04-red?style=flat-square&labelColor=1a1a2e" alt="Version">
  <img src="https://img.shields.io/badge/Scripts-106%20files-orange?style=flat-square&labelColor=1a1a2e" alt="Scripts">
  <img src="https://img.shields.io/badge/Lines-~7%2C800-blue?style=flat-square&labelColor=1a1a2e" alt="Lines">
  <img src="https://img.shields.io/badge/Plugins-12-brightgreen?style=flat-square&labelColor=1a1a2e" alt="Plugins">
  <img src="https://img.shields.io/badge/Routers-21-ff69b4?style=flat-square&labelColor=1a1a2e" alt="Routers">
  <img src="https://img.shields.io/badge/Teams-9-yellow?style=flat-square&labelColor=1a1a2e" alt="Teams">
  <img src="https://img.shields.io/badge/Cap-54%20players-lightgrey?style=flat-square&labelColor=1a1a2e" alt="Cap">
</p>
