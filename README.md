<div align="center">

# ⚔️ UHCRun Add-on

**A high-performance UHC gameplay system for Minecraft Bedrock Edition**

![Minecraft](https://img.shields.io/badge/Minecraft-Bedrock_1.21+-00AA00?style=flat-square&logo=minecraft&logoColor=white)
![API](https://img.shields.io/badge/@minecraft%2Fserver-1.26.0.2-0078D4?style=flat-square)
![Language](https://img.shields.io/badge/Language-JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)
![Players](https://img.shields.io/badge/Players-20--30-red?style=flat-square)

</div>

---

## Overview

UHCRun is a fully custom **Ultra Hardcore** gameplay addon built on the Minecraft Bedrock Script API.  
It handles everything from team management, dynamic world border shrinking, kill tracking, to an in-world NPC leaderboard — all optimized for competitive multiplayer sessions of 20–30 players.

---

## Features

- ⚔️ **Team System** — 9 teams, join via Compass menu, persistent across sessions via DynamicProperty
- 🗺️ **Dynamic World Border** — smooth lerp shrink through checkpoints (500 → 2), particle rendering, fog & damage outside border
- 📊 **Kill / Death Tracking** — per-player and per-team stats stored in Scoreboard + DynamicProperty
- 🏆 **NPC Leaderboard** — in-world NPCs showing Top Players, Top Teams, and Top Deaths
- 🔔 **Announcer System** — First Blood, Multi Kill (up to ACE), Kill Streak
- 🪓 **Plugins** — AutoSmelt, custom Axe mechanics, CPS counter, Enchant tweaks, Fishing HoD, Knockback
- 🎮 **Admin Panel** — full in-game UI for team management, teleport, stats viewer, debug maps
- ⚡ **Optimized** — tick-cached player lists, dirty-flag scoreboard updates, grouped particle rendering

---

## Requirements

- Minecraft Bedrock Edition `1.21+`
- `@minecraft/server` `1.26.0.2`
- `@minecraft/server-ui`
- Behavior Pack with Script API enabled

---

## Installation

```bash
git clone https://github.com/SolightzZ/uhcrun-addon.git
```

1. Copy the behavior pack folder into your world's `behavior_packs/`
2. Enable the pack in **World Settings → Add-Ons → Behavior Packs**
3. Enable **Beta APIs** in Experiments (if required by your version)

---

## Usage

### Admin Commands

| Command | Description |
|---|---|
| `/addon:uhcsetup` | Load structure, set gamerules, distribute kits to all players |
| `/addon:uhcstart` | Start the game — scatter teams, open border, begin countdown |
| `/addon:uhcreset` | Full reset — clear teams, stats, tags, and scoreboard |
| `/addon:uhcend` | End the game and return players to lobby |
| `/addon:tpa` | Spectator teleport menu (Spectators / Admins only) |

### In-Game

| Action | How |
|---|---|
| Open main menu | Use **Compass** |
| Join / leave team | Compass → Team |
| Admin panel | Compass → Admin *(requires `admin` tag)* |
| Refresh leaderboard | **Sneak + interact** with NPC |

---

## Configuration

Edit values directly in the source files:

**`system/border.js`**
```js
const CHECKPOINTS = [500, 450, 400, 350, 300, 250, 200, 150, 100, 80, 50, 25, 16, 10, 5, 2];
const FIRST_SHRINK_DELAY = 300; // ticks before first shrink
const BORDER_RENDER = { VIEW_DISTANCE: 35, PARTICLE_Y: 100 };
```

**`Manager/TeamManager.js`**
```js
const TEAMS = [ /* add/remove teams here */ ];
const CONFIG = { adminTag: "admin", comPass: "uhc" };
```

---

## Project Structure

```
📦 UHCRun
├── main.js                        Entry point — imports all modules
├── system/
│   └── border.js                  World border, shrink state machine, damage, particle render
├── Manager/
│   ├── TeamManager.js             Team system, kill/death tracking, scoreboard, caches
│   ├── Leaderboard.js             NPC leaderboard rendering
│   ├── ScoreboardManager.js       Scoreboard utilities
│   └── constants.js               Shared team definitions
├── customCommand/
│   ├── command.js                 Custom command registry
│   └── function.js                Command handlers (setup, start, reset, end)
├── plugin/
│   ├── axe.js                     Custom axe mechanics
│   ├── AutoSmelt.js               Auto-smelt on mine
│   ├── cps.js                     CPS counter
│   ├── enchant.js                 Enchant tweaks
│   ├── fishing_hod.js             Fishing HoD mechanic
│   ├── golden_order.js            Golden order system
│   ├── Knockback.js               Custom knockback
│   └── sounds.js                  Sound events
├── utils/
│   └── nametag.js                 Nametag formatting
└── FormData/
    ├── CompassMenu.js             Main compass UI
    └── DeathOnForm.js             Death screen UI
```

---

## Architecture

```
system.runInterval (every 20 ticks)
│
├── refreshPlayerCaches()          world.getPlayers() → allPlayersCache / uhcPlayersCache
│
├── WorldTick(uhcPlayers)
│   ├── eventBorders()             checkpoint timer → applyBorderShrink()
│   ├── updateSmoothBorder()       lerp borderRadius → syncWorldBorderGeometry()
│   ├── updateScore()              dirty-flag scoreboard lines
│   └── BorderTick()
│       ├── handleBorderDamage()   every 2 ticks — fog + applyDamage
│       └── renderBorderAABB()     every 4 ticks — grouped particle spawn
│
└── PlayersTick(allPlayers)
    ├── handleGameStart()          tick 1–26 only
    └── displayGameStart()         action bar countdown
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| `@minecraft/server` 1.26.0.2 | Core game API — entities, world, events, scoreboard |
| `@minecraft/server-ui` | ActionFormData menus |
| JavaScript (ESM) | Scripting language |
| DynamicProperty | Persistent team & stats storage |
| Scoreboard | Real-time kill tracking & leaderboard |

---

## Server Spec (Reference)

| Component | Spec |
|---|---|
| CPU | Intel Core i5 Gen 11 |
| RAM | 16GB DDR4-3200 |
| Storage | SSD NVMe |
| Target Players | 20–30 per session |

---

## Author

**SolightzZ**  
Minecraft Bedrock Script API Developer

---

## License

MIT License — see [LICENSE](LICENSE) for details.
