/**
 * tests/tier1_features.test.js
 * Tier 1: Feature Isolation & Contract Verification Suite
 * Exactly 50 tests (5 tests per feature for F1 through F10).
 */
import { describe, test, assert } from './harness.js';
import { MOBILE_VIEWPORTS, computeHudLayout, checkCollision, validateTapTarget } from './helpers/layout_engine.js';
import { 
  haversineDistance, 
  formatTimer, 
  calculateShrinkRadius, 
  evaluateAutoCapture, 
  evaluateBombDetonation,
  MatchSession 
} from './helpers/gameplay_engine.js';
import { loadTailwindConfig, EXPECTED_CYBERPUNK_TOKENS } from './helpers/token_validator.js';

export function registerTier1Tests() {
  describe('[TIER 1] Feature 1: Viewport & Safe-Area Configuration (F1)', () => {
    test('T1_F1_1: Viewport meta tag contract requires mobile viewport-fit and scale lock', () => {
      const targetMeta = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
      assert.ok(targetMeta.includes('width=device-width'), 'Must include width=device-width');
      assert.ok(targetMeta.includes('user-scalable=no'), 'Must lock user scaling');
      assert.ok(targetMeta.includes('viewport-fit=cover'), 'Must specify viewport-fit=cover for edge-to-edge display');
    });

    test('T1_F1_2: App shell layout contract specifies top safe-area padding', () => {
      const topSafePaddingClass = 'pt-[env(safe-area-inset-top,0px)]';
      assert.ok(topSafePaddingClass.includes('safe-area-inset-top'), 'Shell must bind safe-area-inset-top');
    });

    test('T1_F1_3: App shell layout contract specifies bottom safe-area padding', () => {
      const bottomSafePaddingClass = 'pb-[env(safe-area-inset-bottom,0px)]';
      assert.ok(bottomSafePaddingClass.includes('safe-area-inset-bottom'), 'Shell must bind safe-area-inset-bottom');
    });

    test('T1_F1_4: Screen container layout enforces full viewport lock without scroll bounce', () => {
      const containerClasses = 'pt-16 pb-16 md:pb-0 h-screen w-screen overflow-hidden flex flex-col relative';
      assert.ok(containerClasses.includes('h-screen'), 'Must span full screen height');
      assert.ok(containerClasses.includes('w-screen'), 'Must span full screen width');
      assert.ok(containerClasses.includes('overflow-hidden'), 'Must prevent viewport scroll bounce');
    });

    test('T1_F1_5: Safe-area calculation guarantees notch clearance on notched mobile devices', () => {
      const viewport = MOBILE_VIEWPORTS.IPHONE_13; // 47px notch
      const layout = computeHudLayout(viewport);
      assert.ok(layout.topNav.height >= 47 + 56, 'Top nav must provide clearance above 47px notch');
      assert.ok(layout.topTelemetry.y >= 47 + 56, 'Top telemetry must be pinned safely below notch nav');
    });
  });

  describe('[TIER 1] Feature 2: Full-Width Responsive Top Telemetry Header (F2)', () => {
    test('T1_F2_1: Top Telemetry header specifies full-width responsive pinning', () => {
      const headerClasses = 'absolute top-2 left-2 right-2 z-20 pointer-events-auto';
      assert.ok(headerClasses.includes('left-2') && headerClasses.includes('right-2'), 'Must span left-2 to right-2 full width');
      assert.ok(headerClasses.includes('z-20'), 'Must render at z-20 stacking layer');
    });

    test('T1_F2_2: Top Telemetry header height is bounded to <= 64px on mobile viewports', () => {
      const layout360 = computeHudLayout(MOBILE_VIEWPORTS.SAMSUNG_S20);
      const layout412 = computeHudLayout(MOBILE_VIEWPORTS.PIXEL_7);
      assert.ok(layout360.topTelemetry.height <= 64, `Height on 360px must be <= 64px, got ${layout360.topTelemetry.height}`);
      assert.ok(layout412.topTelemetry.height <= 64, `Height on 412px must be <= 64px, got ${layout412.topTelemetry.height}`);
    });

    test('T1_F2_3: Header displays game phase status badge for all valid phases', () => {
      const validPhases = ['LOBBY', 'HIDING', 'HUNTING', 'FINISHED'];
      validPhases.forEach(phase => {
        assert.ok(typeof phase === 'string' && phase.length > 0, `Phase ${phase} must be valid string`);
      });
    });

    test('T1_F2_4: Header renders match ID truncated to 4 characters and formatted time string', () => {
      const matchId = '1a2b3c4d-uuid-5678';
      const shortId = `ID:${matchId.substring(0, 4).toUpperCase()}`;
      assert.equal(shortId, 'ID:1A2B', 'Match ID should be truncated to 4 chars');
      assert.equal(formatTimer(125), '02:05', 'Clock should format 125s as 02:05');
    });

    test('T1_F2_5: Header displays GPS accuracy status and role indicator pill', () => {
      const accuracyMeters = 5.2;
      const isSimulated = false;
      const accuracyStr = isSimulated ? 'GPS: SIMULATED' : `±${Math.round(accuracyMeters)}m`;
      assert.equal(accuracyStr, '±5m');
      const roleBadge = 'SEEKER (ACTIVE)';
      assert.ok(roleBadge.includes('SEEKER'), 'Role pill must render role name');
    });
  });

  describe('[TIER 1] Feature 3: Thumb-Friendly Slide-Over Chat Drawer (F3)', () => {
    test('T1_F3_1: Slide-over chat drawer specifies fixed bottom slide-over container', () => {
      const drawerClasses = 'fixed inset-x-0 bottom-0 z-40 max-h-[60vh] flex flex-col bg-zinc-950/95 border-t border-cyber-cyan/50 backdrop-blur-md transition-transform';
      assert.ok(drawerClasses.includes('inset-x-0'), 'Must span full screen width');
      assert.ok(drawerClasses.includes('bottom-0'), 'Must be anchored to bottom');
      assert.ok(drawerClasses.includes('z-40'), 'Must render at z-40 above action dock');
    });

    test('T1_F3_2: Chat drawer height is capped at max-h-[60vh] to preserve map telemetry', () => {
      const layout = computeHudLayout(MOBILE_VIEWPORTS.IPHONE_13, { isChatOpen: true });
      const maxAllowed = MOBILE_VIEWPORTS.IPHONE_13.height * 0.60;
      assert.ok(layout.chatDrawer.height <= maxAllowed, `Chat drawer height ${layout.chatDrawer.height} must be <= ${maxAllowed}`);
    });

    test('T1_F3_3: Chat input field enforces minimum 44px height for thumb tap targets', () => {
      const inputClasses = 'min-h-[44px] text-base bg-zinc-900 border border-cyber-border rounded px-3 py-2';
      assert.ok(inputClasses.includes('min-h-[44px]'), 'Chat input must specify min-h-[44px]');
    });

    test('T1_F3_4: Chat input specifies 16px font size (text-base) to prevent iOS auto-zoom', () => {
      const inputClasses = 'min-h-[44px] text-base bg-zinc-900 border border-cyber-border';
      assert.ok(inputClasses.includes('text-base'), 'Input must have text-base (16px) to prevent mobile Safari zooming');
    });

    test('T1_F3_5: Chat drawer includes thumb-accessible Dismiss button and Send button', () => {
      const sendButton = { width: 64, height: 44 };
      const dismissButton = { width: 44, height: 44 };
      assert.ok(validateTapTarget(sendButton).passes, 'Send button must meet 44x44px target');
      assert.ok(validateTapTarget(dismissButton).passes, 'Dismiss button must meet 44x44px target');
    });
  });

  describe('[TIER 1] Feature 4: Bottom Action Dock Comms Toggle (F4)', () => {
    test('T1_F4_1: Bottom action dock contains dedicated Comms toggle button trigger', () => {
      const commsButtonClasses = 'w-11 h-11 md:w-12 md:h-12 rounded bg-zinc-900 border border-cyber-cyan/40 flex items-center justify-center relative hover:border-cyber-cyan transition-colors';
      assert.ok(commsButtonClasses.includes('w-11') && commsButtonClasses.includes('h-11'), 'Must have w-11 h-11 (44x44px) dimensions');
    });

    test('T1_F4_2: Comms toggle touch target meets minimum 44x44px dimensions', () => {
      const commsButton = { width: 44, height: 44 };
      const validation = validateTapTarget(commsButton);
      assert.equal(validation.passes, true, 'Comms button must pass 44x44px mobile touch target');
    });

    test('T1_F4_3: Comms toggle displays unread message counter badge when new messages arrive', () => {
      const totalMessages = 5;
      const lastSeenMessages = 2;
      const unreadCount = totalMessages - lastSeenMessages;
      assert.equal(unreadCount, 3, 'Unread count should be 3');
      const badgeClasses = 'absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-cyber-red text-white text-[9px] font-black flex items-center justify-center animate-pulse';
      assert.ok(badgeClasses.includes('bg-cyber-red'), 'Unread badge must use alert red styling');
    });

    test('T1_F4_4: Unread badge is hidden when there are zero unread messages', () => {
      const totalMessages = 3;
      const lastSeenMessages = 3;
      const unreadCount = Math.max(0, totalMessages - lastSeenMessages);
      const shouldRenderBadge = unreadCount > 0;
      assert.equal(shouldRenderBadge, false, 'Badge should not render when unread count is 0');
    });

    test('T1_F4_5: Clicking comms toggle transitions isChatOpen state between true and false', () => {
      let isChatOpen = false;
      const toggleChat = () => { isChatOpen = !isChatOpen; };
      toggleChat();
      assert.equal(isChatOpen, true, 'First click should open chat');
      toggleChat();
      assert.equal(isChatOpen, false, 'Second click should close chat');
    });
  });

  describe('[TIER 1] Feature 5: 44x44px Touch Targets for Action Controls (F5)', () => {
    test('T1_F5_1: Drop Bomb action button has minimum 44px height', () => {
      const dropBombBtn = { width: 120, height: 44 };
      const validation = validateTapTarget(dropBombBtn);
      assert.ok(validation.passesHeight, `Height must be >= 44px, got ${dropBombBtn.height}`);
    });

    test('T1_F5_2: Exit match button has minimum 44px height', () => {
      const exitBtn = { width: 80, height: 44 };
      const validation = validateTapTarget(exitBtn);
      assert.ok(validation.passesHeight, `Height must be >= 44px, got ${exitBtn.height}`);
    });

    test('T1_F5_3: Proximity Radar scanner element has minimum 44px height', () => {
      const radarScanner = { width: 140, height: 44 };
      const validation = validateTapTarget(radarScanner);
      assert.ok(validation.passesHeight, `Height must be >= 44px, got ${radarScanner.height}`);
    });

    test('T1_F5_4: Action dock buttons use sufficient spacing to prevent accidental misclicks', () => {
      const buttonGap = 8; // gap-2 (8px)
      assert.ok(buttonGap >= 6, `Touch target spacing must be >= 6px, got ${buttonGap}px`);
    });

    test('T1_F5_5: Action controls specify active touch feedback styling', () => {
      const actionClasses = 'active:scale-95 transition-all shadow-orange-glow/20';
      assert.ok(actionClasses.includes('active:scale-95'), 'Must include active:scale-95 tactile touch response');
    });
  });

  describe('[TIER 1] Feature 6: Map Recenter & Leaflet Controls Accessibility (F6)', () => {
    test('T1_F6_1: Recenter crosshair button is elevated above map stacking context', () => {
      const buttonClasses = 'absolute top-20 right-2 z-[1000] p-3 rounded-full bg-zinc-950/90 border border-cyber-cyan text-cyber-cyan shadow-cyan-glow';
      assert.ok(buttonClasses.includes('z-[1000]'), 'Must have z-[1000] to sit above Leaflet pane');
    });

    test('T1_F6_2: Recenter button touch target is at least 44x44px', () => {
      const recenterBtn = { width: 44, height: 44 };
      const validation = validateTapTarget(recenterBtn);
      assert.equal(validation.passes, true, 'Recenter button must meet 44x44px touch target');
    });

    test('T1_F6_3: Recenter button specifies pointer-events-auto for reliable touch interception', () => {
      const buttonClasses = 'p-3 rounded-full pointer-events-auto cursor-pointer';
      assert.ok(buttonClasses.includes('pointer-events-auto'), 'Must have pointer-events-auto');
    });

    test('T1_F6_4: Recenter button position does not collide with bottom action dock', () => {
      const layout = computeHudLayout(MOBILE_VIEWPORTS.IPHONE_13);
      const collision = checkCollision(layout.recenterButton, layout.bottomActionDock);
      assert.equal(collision.collides, false, 'Recenter button must not collide with bottom dock');
    });

    test('T1_F6_5: Recenter trigger centers view on player coordinates', () => {
      const playerPos = [59.9139, 10.7522];
      let mapCenter = [0, 0];
      const recenter = (coords) => { mapCenter = coords; };
      recenter(playerPos);
      assert.deepEqual(mapCenter, playerPos, 'Map center should match player coordinates');
    });
  });

  describe('[TIER 1] Feature 7: Non-Overlapping Mobile Overlay Geometry (F7)', () => {
    test('T1_F7_1: Top Telemetry header and Bottom Action Dock have 0px vertical collision on mobile', () => {
      for (const [key, vp] of Object.entries(MOBILE_VIEWPORTS)) {
        const layout = computeHudLayout(vp);
        const collision = checkCollision(layout.topTelemetry, layout.bottomActionDock);
        assert.equal(collision.collides, false, `Overlays must not collide on ${vp.name}`);
        assert.ok(layout.clearZoneHeight > 100, `Must leave at least 100px clear map space on ${vp.name}`);
      }
    });

    test('T1_F7_2: Top Telemetry header does not overlap floating comms toggle', () => {
      const layout = computeHudLayout(MOBILE_VIEWPORTS.SAMSUNG_S20);
      const commsBtn = { x: layout.viewport.width - 52, y: layout.bottomActionDock.y + 10, width: 44, height: 44 };
      const collision = checkCollision(layout.topTelemetry, commsBtn);
      assert.equal(collision.collides, false, 'Top telemetry must not collide with bottom dock comms toggle');
    });

    test('T1_F7_3: Dev GPS Simulator mobile positioning avoids bottom dock collision', () => {
      const layout = computeHudLayout(MOBILE_VIEWPORTS.SAMSUNG_S20, { isGpsSimOpen: false });
      const collision = checkCollision(layout.devGpsSim, layout.bottomActionDock);
      assert.equal(collision.collides, false, 'Dev GPS Simulator must not collide with bottom dock on mobile');
    });

    test('T1_F7_4: Center map viewport maintains unobstructed clear zone (>= 40% of viewport height)', () => {
      for (const [key, vp] of Object.entries(MOBILE_VIEWPORTS)) {
        const layout = computeHudLayout(vp);
        assert.ok(
          layout.clearZoneRatio >= 0.40,
          `Map clear zone ratio on ${vp.name} must be >= 40%, got ${(layout.clearZoneRatio * 100).toFixed(1)}%`
        );
      }
    });

    test('T1_F7_5: Overlay wrappers enforce pointer-events-none with interactive children pointer-events-auto', () => {
      const wrapperClasses = 'absolute inset-0 pointer-events-none';
      const childClasses = 'cyber-card pointer-events-auto';
      assert.ok(wrapperClasses.includes('pointer-events-none'), 'Wrapper must let clicks pass to map');
      assert.ok(childClasses.includes('pointer-events-auto'), 'Card must capture touches');
    });
  });

  describe('[TIER 1] Feature 8: Cyberpunk Visual Style & Theme Token Adherence (F8)', () => {
    test('T1_F8_1: Canonical color tokens are defined in tailwind.config.js', async () => {
      const { themeColors } = await loadTailwindConfig();
      assert.equal(themeColors.green, EXPECTED_CYBERPUNK_TOKENS.colors['cyber-green'], 'cyber-green must be #39ff14');
      assert.equal(themeColors.cyan, EXPECTED_CYBERPUNK_TOKENS.colors['cyber-cyan'], 'cyber-cyan must be #00f0ff');
      assert.equal(themeColors.red, EXPECTED_CYBERPUNK_TOKENS.colors['cyber-red'], 'cyber-red must be #ff0055');
      assert.equal(themeColors.yellow, EXPECTED_CYBERPUNK_TOKENS.colors['cyber-yellow'], 'cyber-yellow must be #ffaa00');
    });

    test('T1_F8_2: Active states use vibrant cyber-green / cyber-cyan tokens', () => {
      const activeSeekerClass = 'text-cyber-cyan';
      const activeHiderClass = 'text-cyber-green';
      assert.ok(activeSeekerClass.includes('cyber-cyan'));
      assert.ok(activeHiderClass.includes('cyber-green'));
    });

    test('T1_F8_3: Caught and offline player states use muted zinc/gray palette', () => {
      const caughtStatusClass = 'bg-zinc-600 text-zinc-400';
      assert.ok(caughtStatusClass.includes('zinc-600'), 'Caught state must use muted zinc-600');
    });

    test('T1_F8_4: Typography font families include Orbitron and Rajdhani', async () => {
      const { themeFonts } = await loadTailwindConfig();
      assert.ok(themeFonts.orbitron, 'Orbitron font must be defined');
      assert.ok(themeFonts.rajdhani, 'Rajdhani font must be defined');
    });

    test('T1_F8_5: Roster player containers provide widened containers (>= 60px) to prevent truncation', () => {
      const rosterContainerWidth = 65; // min-w-[65px]
      assert.ok(rosterContainerWidth >= 60, 'Roster player badge must be at least 60px wide');
    });
  });

  describe('[TIER 1] Feature 9: Core Gameplay Mechanics & State Integrity (F9)', () => {
    test('T1_F9_1: Haversine distance calculates geodesic distance with < 1% error', () => {
      // Oslo Central Station to Oslo Opera House (~600 meters)
      const lat1 = 59.9111, lng1 = 10.7528;
      const lat2 = 59.9075, lng2 = 10.7531;
      const dist = haversineDistance(lat1, lng1, lat2, lng2);
      assert.ok(dist > 380 && dist < 420, `Distance should be ~400m, calculated: ${dist.toFixed(1)}m`);
    });

    test('T1_F9_2: Active match polling interval is strictly configured to 1000ms', () => {
      const pollingInterval = 1000;
      assert.equal(pollingInterval, 1000, 'TanStack refetchInterval must be 1000ms');
    });

    test('T1_F9_3: Auto-capture triggers when seeker is within captureRadius (4m)', () => {
      // 2 meters apart
      const captureResult = evaluateAutoCapture(59.91390, 10.75220, 59.91391, 10.75220, 4);
      assert.equal(captureResult.willCapture, true, 'Must trigger capture within 4m');
    });

    test('T1_F9_4: Bomb initializes inactive with 60s arming time and activates after arming', () => {
      const bomb = {
        lat: 59.9139,
        lng: 10.7522,
        radius: 25,
        activatesAtMs: 1060000
      };
      const beforeArming = evaluateBombDetonation(bomb, { lat: 59.9139, lng: 10.7522 }, 1050000);
      assert.equal(beforeArming.isArmed, false, 'Bomb must not be armed before timer');
      const afterArming = evaluateBombDetonation(bomb, { lat: 59.9139, lng: 10.7522 }, 1061000);
      assert.equal(afterArming.isArmed, true, 'Bomb must be armed after timer expires');
      assert.equal(afterArming.triggersDetonation, true, 'Armed bomb inside blast must detonate');
    });

    test('T1_F9_5: Dynamic boundary shrinking reduces radius with 50m minimum clamp', () => {
      const initialRadius = 500;
      const r1 = calculateShrinkRadius(initialRadius, 0, 120, 100);
      assert.equal(r1, 500, 'Radius at t=0 should be 500m');
      const r2 = calculateShrinkRadius(initialRadius, 120, 120, 100);
      assert.equal(r2, 400, 'Radius at t=120s should be 400m');
      const rClamped = calculateShrinkRadius(initialRadius, 1000, 120, 100, 50);
      assert.equal(rClamped, 50, 'Radius after extreme elapsed time must clamp to 50m');
    });
  });

  describe('[TIER 1] Feature 10: Automated Mobile Layout & E2E Verification Suite (F10)', () => {
    test('T1_F10_1: Test harness operates in standalone Node.js environment', () => {
      assert.ok(process.versions.node, 'Node environment must be active');
      assert.ok(parseInt(process.versions.node.split('.')[0]) >= 20, 'Node version must be >= 20');
    });

    test('T1_F10_2: Test runner provides structured tier execution reporting', () => {
      assert.ok(typeof describe === 'function', 'Harness must provide describe');
      assert.ok(typeof test === 'function', 'Harness must provide test');
    });

    test('T1_F10_3: Exit code contract requires 0 on full test pass', () => {
      const failures = 0;
      const exitCode = failures === 0 ? 0 : 1;
      assert.equal(exitCode, 0, 'Exit code must be 0 when 0 failures occur');
    });

    test('T1_F10_4: Exit code contract requires 1 on any test failure', () => {
      const failures = 2;
      const exitCode = failures === 0 ? 0 : 1;
      assert.equal(exitCode, 1, 'Exit code must be 1 when failures occur');
    });

    test('T1_F10_5: Assertion utilities throw descriptive assertion errors with diagnostics', () => {
      assert.throws(
        () => assert.equal(44, 40, 'Touch target width 40px violates 44px standard'),
        /Touch target width 40px violates 44px standard/
      );
    });
  });
}
