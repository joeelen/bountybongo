# Project: Bountyrunner — Polish, Accessible Outdoor GPS Party Game Modes & Progression

## Architecture
- **Client Root**: `src/App.tsx` provides the application shell, Wouter routing, top navigation bar, bottom mobile navigation bar, and global providers (`QueryClientProvider`, `GpsProvider`, `ToastProvider`, `ThemeProvider`).
- **Match Engine**: `src/pages/Matches.tsx` manages match lifecycle states (`initial`, `lobby`, `hiding`, `hunting`, `finished`). Polls match state every 1000ms via TanStack Query with `x-match-sync` header.
- **Map Subsystem**: `src/components/MapContainer.tsx` wraps React-Leaflet (`MapContainer`, `TileLayer`, `Circle`, `Marker`). Manages user GPS pin, seeker snapshots, bomb markers, collectibles, shrinking play boundary circle, and center map control.
- **HUD Layering**:
  - Top Telemetry Bar: Full-width responsive header pinned below top nav (height $\le 64\text{px}$), displaying game mode, phase, clocks, GPS accuracy, role status, and score.
  - Floating Tactical Action Bar: Pinned above bottom dock (`z-25`), hosting 48x48px power-up buttons (Sprint Boost, Decoy Drone, Shield Bubble, Freeze Trap) with radial cooldowns.
  - Bottom Action Dock: Pinned above bottom nav (`z-20`), hosting participant roster, Drop Bomb action, Proximity Radar scanner, Comms drawer trigger, and Exit match button.
  - Slide-Over Chat Drawer: Responsive drawer at `z-40` (`max-h-[60vh]`) with 16px font input preventing iOS auto-zoom.
- **Theme Subsystem**: `src/lib/ThemeContext.tsx` toggles `.theme-bright` on root element, switching Leaflet tiles dynamically between CARTO Dark Matter (`dark_all`) and CARTO Positron (`light_all`).
- **Audio & Haptics**: `src/lib/GameEffects.ts` synthesizes rich Web Audio cues (countdown chimes, match start, power-ups, freeze/unfreeze, victory/defeat fanfares) and haptic pulses.
- **Gamification & Progression**: `src/pages/Profile.tsx` and `src/components/PostMatchCeremonyModal.tsx` deliver daily operations with streaks, 8+ unlockable titles, and animated XP victory debriefs.
- **Backend & Database**: `server/schema.ts` and `server/index.ts` support multi-game-mode parameters (`gameMode`, `isFrozen`, `collectibles`), auto-capture, rescue, infection conversions, and power-up cooldown validation.
- **Automated Test Suite**: Pure Node.js test runner in `tests/runner.js` verifying layout geometry, boundary conditions, game modes, and power-ups across Tiers 1-5.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F1 | Mobile UI Polish & Layout Overhaul | Eliminate micro-fonts (`text-[8px]` -> `text-[10px]`), resolve global nav `z-50` vs in-match chat `z-40` occlusion, and fix text wrapping and awkward margins on 360px/375px screens across Leaderboard, Landing, and Social. | M1 | Survey Explorer 2 |
| F2 | Outdoor Bright / Dark Theme System | Client `ThemeContext` toggling `.theme-bright`, dynamic CartoDB Dark Matter vs Positron Light tiles, high-contrast outdoor boundary circle (`#0284c7`), and dark player outlines for sunlight play. | M1 | Survey Explorer 2 |
| F3 | Web Audio Synthesis & Haptic Cues Suite | Synthesized Web Audio cues for countdown chimes, match start, power-ups, freeze/unfreeze, celebration fanfares, and haptics in `GameEffects.ts`. | M1 | Survey Explorer 2 |
| F4 | Kid- & Family-Friendly Party Game Modes Engine | Support `gameMode: 'classic' \| 'freeze_tag' \| 'infection' \| 'treasure_hunt'` in match creation, lobby host settings, server state, and `x-match-sync` rehydration. | M2 | Survey Explorer 1 |
| F5 | Freeze Tag ("Boksen går") Mechanics | Seeker tag freezes runner (`isFrozen = true`); teammates unfreeze within `rescueRadius` (10m) via rescue action; 3s freeze immunity; frozen status badges on map and roster; win on all frozen. | M2 | Survey Explorer 1 |
| F6 | Infection / Zombie Tag Mechanics | Alpha Zombie seeker infects runners on tag; caught runners convert to seekers (`role = 'seeker'`); marker flips to toxic cyan/green; win on all infected or survivor timer expiration. | M2 | Survey Explorer 1 |
| F7 | Geo-Bounty Skattejakt (Treasure Hunt) Mechanics | Collectible Energy Cubes (50 XP) and Bounty Crystals (150 XP) spawned around boundary; proximity pickup within 10m; map markers and atomic collection endpoint. | M2 | Survey Explorer 1 |
| F8 | Tactical Power-Ups & In-Match Action Bar | In-match HUD floating action bar (`z-25`, 48x48px touch targets): Sprint Boost, Decoy Drone, Shield Bubble, and Freeze Trap with radial cooldown timers and non-overlapping geometry. | M3 | Survey Explorer 2 |
| F9 | Daily Operations, Streaks & Progression | Deterministic UTC date-seeded daily mini-quests (3 quests daily) with streak tracking (🔥), claimable bonus XP, and dual persistence (`localStorage` + cloud API). | M4 | Survey Explorer 3 |
| F10 | Player Badges & Unlockable Titles | Catalog of 8+ unlockable titles ("Sprek Gateløper", "Skyggemester", "Radar-ekspert", etc.) equipable by players and displayed in header, lobby, roster, and ceremony. | M4 | Survey Explorer 3 |
| F11 | Post-Match Celebration & Debrief Ceremony | Animated celebration modal with easing XP counter ticker, granular point breakdown, dynamic MVP badges, and fanfare audio cues. | M4 | Survey Explorer 3 |
| F12 | Comprehensive Game Design Dossier | Authoritative 5-chapter document at `docs/GAME_DESIGN_INSPIRATION.md` detailing player psychology, outdoor safety protocols, and viral growth loops. | M5 | Survey Explorer 3 |
| F13 | Automated E2E Test Suite Expansion & Adversarial Hardening | Add `tests/tier5_gamemodes_powerups.test.js` registered in `runner.js`, verifying game modes, power-ups, daily quests, 100% pass of all ~145+ tests, 0 TS build errors, and forensic audit. | M6 | Survey Explorer 1, 3 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Visual Polish, Bright Outdoor Theme & Web Audio Suite | Implement F1 (micro-fonts, nav/chat z-index, responsive wrapping), F2 (Bright/Dark theme, Positron tiles), and F3 (Web Audio synthesis cues & haptics). | None | DONE |
| M2 | Party Game Modes Engine (Freeze Tag, Infection, Skattejakt) | Implement F4 (multi-game-mode schema & lobby selector), F5 (Freeze Tag & rescue), F6 (Infection conversion), and F7 (Skattejakt collectibles). | M1 | DONE |
| M3 | Tactical Power-Ups & In-Match Action Bar | Implement F8 (thumb-friendly 48x48px power-up action bar, Sprint Boost, Decoy Drone, Shield Bubble, Freeze Trap, cooldown state machines). | M1, M2 | PLANNED |
| M4 | Gamification, Daily Quests & Post-Match Ceremony | Implement F9 (daily operations & streaks), F10 (player badges & equipable titles), and F11 (animated post-match ceremony modal). | M1, M2 | PLANNED |
| M5 | Comprehensive Game Design & Inspiration Dossier | Implement F12 (`docs/GAME_DESIGN_INSPIRATION.md` with 5 foundational chapters). | None | PLANNED |
| M6 | Automated Test Suite Expansion, Final Integration & Audit | Implement F13 (`tests/tier5_gamemodes_powerups.test.js`), run master test runner (100% pass across all tiers), verify `npm run build:client` exits with 0 errors, adversarial coverage hardening, and repository-wide forensic integrity audit. | M1, M2, M3, M4, M5 | PLANNED |

---

## Interface Contracts

### Game Mode & Participant Data Contract
- `GameMode`: `'classic' | 'freeze_tag' | 'infection' | 'treasure_hunt'`
- `Participant`: `isFrozen: boolean`, `frozenAt: string | null`, `rescuesCount: number`, `itemsCollected: number`
- `Collectible`: `id: string`, `type: 'energy_cube' | 'bounty_crystal'`, `lat: number`, `lng: number`, `points: number`, `isCollected: boolean`

### Tactical HUD Overlay Contract
- `Top Telemetry Bar`: `absolute top-2 left-2 right-2 z-20`, height $\le 64\text{px}$
- `Floating Action Bar`: `absolute bottom-[115px] left-1/2 -translate-x-1/2 z-25`, buttons `w-12 h-12` (48x48px)
- `Bottom Action Dock`: `absolute bottom-2 left-2 right-2 z-20`, height $\le 130\text{px}$
- `Slide-Over Chat`: `fixed inset-x-0 bottom-0 z-40 max-h-[60vh]`, input font 16px
- `Map Viewport`: Minimum 350px clear vertical height on all viewports $\ge 640\text{px}$

### Theme & Audio Contract
- Theme class: `.theme-bright` on `<html>`
- Tile Layers: CARTO Dark Matter (`dark_all`) vs CARTO Positron Light (`light_all`)
- Sound Methods on `GameEffects`: `playCountdownChime()`, `playMatchStart()`, `playPowerUp(type)`, `playFreeze()`, `playUnfreeze()`, `playVictoryFanfare()`, `playDefeatSound()`
