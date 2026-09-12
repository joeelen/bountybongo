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
