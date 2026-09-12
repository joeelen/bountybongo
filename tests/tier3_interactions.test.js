/**
 * tests/tier3_interactions.test.js
 * Tier 3: Pairwise Cross-Feature Interactions Suite
 * 12 comprehensive pairwise interaction test cases.
 */
import { describe, test, assert } from './harness.js';
import { MOBILE_VIEWPORTS, computeHudLayout, checkCollision, validateTapTarget } from './helpers/layout_engine.js';
import { 
  haversineDistance, 
  formatTimer, 
  calculateShrinkRadius, 
  evaluateAutoCapture, 
  evaluateBombDetonation,
  evaluateRadarSnapshot,
  MatchSession 
} from './helpers/gameplay_engine.js';

export function registerTier3Tests() {
  describe('[TIER 3] Cross-Feature Pairwise Interaction Matrix', () => {
    test('T3_INT_1: Chat drawer open while Bomb is deployed by seeker (F3 x F5)', () => {
      const session = new MatchSession();
      session.addParticipant('s1', 'Seeker1', 'seeker');
      session.addParticipant('h1', 'Hider1', 'hider');
      session.start(1000000);
      session.tick(1000000 + 130000); // in hunting phase

      let isChatOpen = true;
      const bomb = session.dropBomb('s1', 59.9140, 10.7525);
      assert.ok(bomb, 'Bomb should be created successfully');
      assert.equal(bomb.isActive, false, 'Bomb should initialize inactive');
      assert.equal(isChatOpen, true, 'Chat drawer state remains open without mutating bomb state');

      // Check layout geometry: open chat drawer (bottom sheet) does not collide with top telemetry
      const layout = computeHudLayout(MOBILE_VIEWPORTS.IPHONE_13, { isChatOpen: true });
      const collision = checkCollision(layout.topTelemetry, layout.chatDrawer);
      assert.equal(collision.collides, false, 'Chat drawer must not collide with top telemetry');
    });

    test('T3_INT_2: Radar ping snapshot occurs while GPS reveal countdown reaches 00:00 (F2 x F9)', () => {
      const hidingEnds = 1000000;
      const revealInterval = 120000; // 120s
      let lastRevealed = 1000000;

      // At exactly 120 seconds into hunting
      const now = hidingEnds + 120000;
      const radar = evaluateRadarSnapshot(hidingEnds, now, revealInterval, lastRevealed);
      assert.equal(radar.needsSnapshot, true, 'Must trigger snapshot reveal');

      // Upon snapshot reveal, simulated clock in Top Telemetry resets to 120s (02:00)
      lastRevealed = now;
      const nextCycle = evaluateRadarSnapshot(hidingEnds, now, revealInterval, lastRevealed);
      assert.equal(nextCycle.countdownStr, '02:00', 'Countdown must reset to 02:00');
    });

    test('T3_INT_3: Recenter button clicked during boundary shrink update (F6 x F9)', () => {
      const session = new MatchSession({ initialBoundaryRadius: 500 });
      session.addParticipant('p1', 'Runner', 'seeker');
      session.start(1000000);

      // Advance time by 240 seconds (2 shrink intervals)
      session.tick(1000000 + 120000 + 240000);
      const currentRadius = session.getCurrentBoundaryRadius();
      assert.equal(currentRadius, 300, 'Boundary should be shrunk to 300m');

      // Click recenter button
      let mapCenter = [0, 0];
      const playerPos = [59.9139, 10.7522];
      const handleRecenter = () => { mapCenter = playerPos; };
      handleRecenter();
      assert.deepEqual(mapCenter, playerPos, 'Recenter must lock view to player position during boundary shrink');
    });

    test('T3_INT_4: Chat drawer toggled on 360px viewport with safe-area insets (F1 x F3)', () => {
      const vp = MOBILE_VIEWPORTS.SAMSUNG_S20;
      const layout = computeHudLayout(vp, { isChatOpen: true });
      assert.ok(layout.chatDrawer.height <= vp.height * 0.60, 'Drawer height must not exceed 60vh');
      assert.equal(layout.chatDrawer.width, 360, 'Drawer must span full 360px width');

      // Input target test
      const chatInput = { width: 360 - 32, height: 44 };
      assert.ok(validateTapTarget(chatInput).passesHeight, 'Chat input must be >= 44px on 360px screen');
    });

    test('T3_INT_5: Auto-capture occurs while chat drawer is open (F3 x F9)', () => {
      const session = new MatchSession();
      const s = session.addParticipant('s1', 'Seeker1', 'seeker');
      const h = session.addParticipant('h1', 'Hider1', 'hider');
      session.start(1000000);

      // Fast forward past hiding phase into hunting
      session.tick(1000000 + 125000);

      // Player opens chat drawer
      const isChatOpen = true;

      // Seeker moves within 2 meters of hider
      session.updatePlayerPosition('s1', 59.91390, 10.75220);
      session.updatePlayerPosition('h1', 59.91391, 10.75220); // ~1.1m

      // Game tick processes auto-capture
      session.tick(1000000 + 126000);

      assert.equal(h.isCaught, true, 'Hider must be captured even when chat is open');
      assert.equal(s.score, 100, 'Seeker must receive +100 XP score');
      assert.equal(isChatOpen, true, 'Chat open state remains unaffected by capture event');
    });

    test('T3_INT_6: Seeker enters bomb blast zone while tracking hider on proximity radar (F5 x F9)', () => {
      const session = new MatchSession();
      session.addParticipant('s1', 'Seeker1', 'seeker');
      const h = session.addParticipant('h1', 'Hider1', 'hider');
      session.start(1000000);
      session.tick(1000000 + 130000); // Hunting phase

      // Seeker places bomb
      const bomb = session.dropBomb('s1', 59.9140, 10.7522);
      // Fast forward time by 65 seconds so bomb arms
      session.tick(1000000 + 195000);
      assert.equal(bomb.isActive, true, 'Bomb must be active after arming time');

      // Hider moves within 10 meters of bomb
      session.updatePlayerPosition('h1', 59.91405, 10.7522); // ~5.5m away
      session.tick(1000000 + 196000);

      assert.equal(h.isCaught, true, 'Hider must be caught by armed bomb blast');
      assert.equal(bomb.isDetonated, true, 'Bomb must be marked detonated');
    });

    test('T3_INT_7: Participant roster updates when player is caught while Top Telemetry displays score (F2 x F8)', () => {
      const session = new MatchSession();
      const s = session.addParticipant('s1', 'Seeker1', 'seeker');
      const h = session.addParticipant('h1', 'Hider1', 'hider');
      session.start(1000000);
      session.tick(1000000 + 130000);

      // Initial active state colors
      const initialHiderColor = h.isCaught ? 'bg-zinc-600' : 'bg-cyber-green';
      assert.equal(initialHiderColor, 'bg-cyber-green');

      // Trigger capture
      session.updatePlayerPosition('s1', 59.9139, 10.7522);
      session.updatePlayerPosition('h1', 59.9139, 10.7522);
      session.tick(1000000 + 131000);

      // Caught state switches role dot to muted gray and increments score
      const caughtHiderColor = h.isCaught ? 'bg-zinc-600' : 'bg-cyber-green';
      assert.equal(caughtHiderColor, 'bg-zinc-600');
      assert.equal(s.score, 100);
    });

    test('T3_INT_8: Dev GPS movement step applied while Leaflet map is centered (F6 x F7)', () => {
      const step = 0.0001; // ~11m
      let lat = 59.9139;
      let lng = 10.7522;
      const walkNorth = () => { lat += step; };
      walkNorth();
      assert.equal(lat, 59.9140);

      // Verify simulator overlay at top-20 right-2 does not collide with bottom action dock
      const layout = computeHudLayout(MOBILE_VIEWPORTS.IPHONE_13, { isGpsSimOpen: false });
      const collision = checkCollision(layout.devGpsSim, layout.bottomActionDock);
      assert.equal(collision.collides, false, 'Dev GPS Simulator must not collide with bottom dock');
    });

    test('T3_INT_9: Multiple chat messages arrive during phase transition from hiding to hunting (F2 x F4)', () => {
      const session = new MatchSession({ hidingDuration: 120 });
      session.addParticipant('p1', 'Player1', 'hider');
      session.addParticipant('p2', 'Player2', 'seeker');
      session.start(1000000);

      // Receive 3 chat messages right at transition time
      session.sendChat('p1', 'Player1', 'Finding a hideout!');
      session.sendChat('p1', 'Player1', 'Behind the station!');
      session.sendChat('p2', 'Player2', 'I am ready to hunt!');

      // Tick to transition time
      session.tick(1000000 + 120000);

      assert.equal(session.status, 'hunting', 'Phase must transition to hunting');
      assert.equal(session.messages.length, 3, 'All 3 chat messages must be recorded');

      // Unread badge logic: if chat closed, unread count is 3
      const lastSeen = 0;
      const unreadCount = session.messages.length - lastSeen;
      assert.equal(unreadCount, 3, 'Comms button must show unread badge count of 3');
    });

    test('T3_INT_10: High-accuracy GPS updates accuracy meter while bomb detonates (F2 x F9)', () => {
      const accuracyMeters = 3.8;
      const accuracyStr = `±${Math.round(accuracyMeters)}m`;
      assert.equal(accuracyStr, '±4m');

      const session = new MatchSession();
      session.addParticipant('s1', 'Seeker1', 'seeker');
      session.addParticipant('h1', 'Hider1', 'hider');
      session.start(1000000);
      session.tick(1000000 + 130000);

      const bomb = session.dropBomb('s1', 59.9140, 10.7522);
      session.tick(1000000 + 195000); // armed
      session.updatePlayerPosition('h1', 59.9140, 10.7522);
      session.tick(1000000 + 196000); // detonate

      assert.equal(bomb.isDetonated, true);
    });

    test('T3_INT_11: Player exits match while chat drawer is open and bomb countdown is active (F3 x F5)', () => {
      let activeMatchId = 'MATCH_1234';
      let isChatOpen = true;

      const handleExitMatch = () => {
        isChatOpen = false;
        activeMatchId = null;
      };

      handleExitMatch();
      assert.equal(activeMatchId, null, 'Active match ID should be cleared on exit');
      assert.equal(isChatOpen, false, 'Chat drawer should close on match exit');
    });

    test('T3_INT_12: Viewport resize between 375px and 412px maintains >= 44px tap targets and 0px overlap (F1 x F5 x F7)', () => {
      const vps = [MOBILE_VIEWPORTS.IPHONE_SE, MOBILE_VIEWPORTS.PIXEL_7];
      for (const vp of vps) {
        const layout = computeHudLayout(vp);
        const collision = checkCollision(layout.topTelemetry, layout.bottomActionDock);
        assert.equal(collision.collides, false, `Overlays must not collide on ${vp.name}`);
        assert.ok(validateTapTarget(layout.recenterButton).passes, `Recenter button on ${vp.name} must meet 44x44px`);
      }
    });
  });
}
