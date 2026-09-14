# Original User Request

## Initial Request — 2026-09-10T13:29:35Z

Polish and optimize the mobile UI, responsiveness, and visual styling across Bountyrunner, with primary focus on the in-match game HUD and map controls, to deliver a seamless, production-ready smartphone experience.

Working directory: c:/Users/joels/GEMINI PROJECTS (mine egne)/Bountyrunner
Integrity mode: development

## Requirements

### R1. Thumb-Friendly Match HUD & Controls
The in-match view (`Matches.tsx`) must be optimized for one-handed mobile use across standard mobile viewport widths (360px to 430px). All primary player actions (deploying bombs, viewing proximity radar, exiting match, opening/closing comms) must be easily reachable and tapable with comfortable tap targets (minimum 44x44px equivalent touch zones).

### R2. Non-Overlapping Layout & Map Visibility
Overlays (top telemetry card, chat panel/button, and bottom action dock) must not collide or overlap each other on small screens. Map viewports must preserve clear visibility of the player's position, hider pings, placed bombs, and the dynamic shrinking boundary circle.

### R3. Visual Style & Telemetry Consistency
All UI components, typography, status badges, and color palettes must strictly adhere to the unified design language (vibrant green for active states, muted gray for offline states, cyan/yellow/red cyberpunk accents). Telemetry clocks, GPS pings, and role badges must remain legible without truncated text or overflow issues.

## Acceptance Criteria

### Mobile Responsiveness & Layout
- [ ] No overlapping elements between top telemetry, floating chat, and bottom action dock at mobile viewports (tested at 375px and 412px widths).
- [ ] Touch targets for interactive buttons meet mobile accessibility guidelines (easy thumb tap without misclicks).
- [ ] Chat panel expands and collapses smoothly without blocking essential gameplay telemetry or pushing bottom controls off-screen.

### Build & Integrity
- [ ] `npm run build:client` completes cleanly with 0 TypeScript and bundling errors.
- [ ] No regressions in core gameplay functionality (auto-capture, bomb placement, radar reveals, and shrinking boundary logic remain intact).

## Follow-up — 2026-09-13T17:46:29Z

Elevate Bountyrunner from a raw prototype to an irresistibly fun, polished, and accessible real-world outdoor GPS game for both kids, families, and competitive adults. Overhaul the overall game feel, visuals, and UI clarity ("rydde opp i alt som er på halvåtte"), introduce accessible party game modes (Freeze Tag / Infection / Treasure Hunt), dynamic power-ups, and rewarding progression loops, supported by an in-depth Game Design Dossier.

Working directory: c:/Users/joels/GEMINI PROJECTS (mine egne)/Bountyrunner
Integrity mode: development

## Requirements

### R1. Comprehensive Visual Polish & Game Feel Overhaul ("Slutt på halvåtte")
Eliminate awkward alignments, clunky margins, disjointed typography, and rough states across the app. Deliver a sleek, responsive, and tactile mobile-first UI with smooth micro-animations, crisp cyberpunk/adventure accents, and optional Bright Outdoor Mode for sunlight play. Elevate game feel with rich synthesized Web Audio sound cues (countdown chimes, power-up hums, celebration fanfares) and haptic pulses.

### R2. Kid- & Family-Friendly Party Game Modes
Expand beyond standard 1-vs-many hide & seek by implementing accessible match presets selectable by the host:
- **Freeze Tag ("Boksen går"):** Seekers freeze runners on touch; teammate runners can rescue and unfreeze frozen players by tapping them within rescue radius.
- **Infection / Zombie Tag:** Seekers turn caught hiders into fellow seekers until the last survivor remains.
- **Geo-Bounty Skattejakt (Treasure Hunt):** Collectible virtual energy cubes and bounty crystals spawned around the arena boundary for runners and seekers to gather.

### R3. Tactical Power-Ups & Action Abilities
Add a thumb-friendly power-up action bar to the in-match HUD:
- **Sprint Boost:** Temporarily expands catch/dodge mobility buffer.
- **Decoy Drone / Phantom Ping:** Projects a deceptive radar ping on the map to misdirect pursuers.
- **Shield Bubble:** Protects against a single capture or bomb blast.
- **Freeze Trap:** Deploys a ground snare that halts a pursuer's radar for 15 seconds.
Include clear cooldown timers, icon indicators, and balanced gameplay interactions.

### R4. Gamification, Progression & Rewarding Loops
Implement meaningful long-term motivation:
- **Daily Operations & Streaks:** Daily mini-quests (e.g. "Complete 1 match", "Unfreeze a teammate", "Sprint 500m").
- **Player Badges & Unlockable Titles:** Fun identity designations (e.g. "Sprek Gateløper", "Skyggemester", "Radar-ekspert").
- **Victory & Defeat Post-Match Ceremony:** Exciting celebration modal with animated XP counters, MVP badges, and stats breakdown.

### R5. Comprehensive Game Design & Product Inspiration Dossier
Produce an exhaustive Game Design Document (`docs/GAME_DESIGN_INSPIRATION.md`) detailing:
- Kid/family vs Adult/competitive player psychology and engagement loops.
- Safety measures (safe park geofencing, road hazard proximity prompts).
- Future viral growth loops (school yard leaderboards, neighborhood tournaments, AR camera integration).

## Acceptance Criteria

### Game Feel & Visual Polish
- [ ] No visual clipping, awkward wrapping, or mismatched fonts across mobile viewport widths (360px, 375px, 390px, 412px).
- [ ] Responsive Bright / Dark theme toggle working cleanly across map tiles and UI overlays.
- [ ] Web Audio sound effects active for match start, countdown, freeze/unfreeze, power-up use, and victory celebration.

### Game Modes & Power-Ups
- [ ] Match host can select between Classic Hide & Seek, Freeze Tag, Infection, or Treasure Hunt in match settings.
- [ ] Freeze Tag mechanics (freeze on tag, unfreeze by teammate) functioning reliably with visual status indicators on the player roster and map.
- [ ] Power-ups trigger with visual cooldowns and execute effects without breaking GPS synchronization.

### Gamification & Retention
- [ ] Daily quest tracker displayed in Profile or Hub with claimable bonus XP.
- [ ] Post-match summary card displays match results, XP earned, and highlights.

### Codebase Integrity & Verification
- [ ] `npm run build:client` completes cleanly with 0 TypeScript and bundling errors.
- [ ] `node tests/runner.js` passes 100% of existing tests with 0 regressions.
- [ ] Automated tests added to verify new game mode logic and power-up cooldown state transitions.
- [ ] `docs/GAME_DESIGN_INSPIRATION.md` written and stored in the repository.
