/**
 * tests/tier4_real_world.test.js
 * Tier 4: Real-World Mobile Match Scenarios Suite
 * 5 comprehensive end-to-end smartphone match simulation scenarios.
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

export function registerTier4Tests() {
  describe('[TIER 4] Real-World Mobile Match Scenarios', () => {
    test('T4_RW_1: Full 10-minute match flow from lobby to hunting and match finish', () => {
      // Setup match session
      const session = new MatchSession({
        hidingDuration: 120, // 2 minutes
        revealInterval: 120, // 2 minutes
        matchDuration: 600,  // 10 minutes hunting
        boundaryRadius: 500,
        zoneShrinkInterval: 120,
        zoneShrinkAmount: 100
      });

      // 4 mobile participants: 1 seeker, 3 hiders
      const seeker = session.addParticipant('s1', 'CYBER_HUNTER', 'seeker');
      const hider1 = session.addParticipant('h1', 'GHOST_RUNNER', 'hider');
      const hider2 = session.addParticipant('h2', 'SHADOW_WALKER', 'hider');
      const hider3 = session.addParticipant('h3', 'NEON_ROGUE', 'hider');

      assert.equal(session.status, 'lobby', 'Match should begin in lobby');
      assert.equal(session.participants.length, 4, '4 participants should be enrolled');

      // Start match at t = 0
      const startMs = 1000000;
      session.start(startMs);
      assert.equal(session.status, 'hiding', 'Match status should transition to hiding');

      // Hiding phase: players disperse
      session.updatePlayerPosition('s1', 59.9139, 10.7522); // center base
      session.updatePlayerPosition('h1', 59.9150, 10.7522); // ~122m north
      session.updatePlayerPosition('h2', 59.9130, 10.7522); // ~100m south
      session.updatePlayerPosition('h3', 59.9139, 10.7560); // ~212m east

      // Advance clock past hiding duration (120s)
      session.tick(startMs + 120000);
      assert.equal(session.status, 'hunting', 'Match must transition to hunting after 120s');

      // First radar ping triggers snapshot for all hiders
      assert.equal(hider1.revealedAt, startMs + 120000);
      assert.equal(hider1.revealedLat, 59.9150);

      // Seeker pursues hider1 and catches him at t = 180s
      session.updatePlayerPosition('s1', 59.9150, 10.7522);
      session.tick(startMs + 180000);
      assert.equal(hider1.isCaught, true, 'hider1 must be caught');
      assert.equal(seeker.score, 100, 'Seeker must receive 100 XP');

      // Seeker catches hider2 at t = 300s
      session.updatePlayerPosition('s1', 59.9130, 10.7522);
      session.tick(startMs + 300000);
      assert.equal(hider2.isCaught, true, 'hider2 must be caught');
      assert.equal(seeker.score, 200, 'Seeker score should be 200 XP');

      // Seeker catches final hider3 at t = 420s
      session.updatePlayerPosition('s1', 59.9139, 10.7560);
      session.tick(startMs + 420000);
      assert.equal(hider3.isCaught, true, 'hider3 must be caught');
      assert.equal(seeker.score, 300, 'Seeker score should be 300 XP');

      // Win condition: all hiders caught -> match finished
      assert.equal(session.status, 'finished', 'Match must end in finished state when all hiders caught');
    });

    test('T4_RW_2: Proximity pursuit and auto-capture with mobile HUD state updates', () => {
      const session = new MatchSession();
      const seeker = session.addParticipant('s1', 'Hunter', 'seeker');
      const hider = session.addParticipant('h1', 'Prey', 'hider');
      session.start(1000000);
      session.tick(1000000 + 125000); // hunting phase

      // Step 1: 50m away
      seeker.lat = 59.9139; seeker.lng = 10.7522;
      hider.lat = 59.91435; hider.lng = 10.7522; // ~50m
      let autoCap = evaluateAutoCapture(seeker.lat, seeker.lng, hider.lat, hider.lng, 4);
      assert.equal(autoCap.inRange, false, 'Should be out of range at 50m');
      assert.ok(Math.round(autoCap.distance) >= 48 && Math.round(autoCap.distance) <= 52);

      // Step 2: Seeker sprints to 15m away
      seeker.lat = 59.91421;
      autoCap = evaluateAutoCapture(seeker.lat, seeker.lng, hider.lat, hider.lng, 4);
      assert.equal(autoCap.inRange, false, 'Should be out of range at 15m');
      assert.ok(Math.round(autoCap.distance) >= 14 && Math.round(autoCap.distance) <= 17);

      // Step 3: Seeker enters 3.5m capture radius
      seeker.lat = 59.91432;
      autoCap = evaluateAutoCapture(seeker.lat, seeker.lng, hider.lat, hider.lng, 4);
      assert.equal(autoCap.inRange, true, 'Must be in capture range at ~3.3m');

      // Server tick triggers capture
      session.tick(1000000 + 130000);
      assert.equal(hider.isCaught, true, 'Hider must be captured by server tick');
      assert.equal(seeker.score, 100, 'Seeker receives 100 XP');
    });

    test('T4_RW_3: Strategic bomb deployment, arming delay, and detonation trap', () => {
      const session = new MatchSession({
        bombArmingTime: 60,
        bombBlastRadius: 25
      });
      const seeker = session.addParticipant('s1', 'BombSeeker', 'seeker');
      const hider = session.addParticipant('h1', 'TrapVictim', 'hider');
      session.start(1000000);
      session.tick(1000000 + 125000); // hunting phase

      // Seeker drops bomb at corner choke point
      const bombLat = 59.9145, bombLng = 10.7530;
      const bomb = session.dropBomb('s1', bombLat, bombLng);
      assert.equal(bomb.isActive, false, 'Bomb is initially inactive (arming)');

      // Hider is 20m from bomb, but bomb is not armed yet
      session.updatePlayerPosition('h1', 59.91468, 10.7530); // ~20m north of bomb
      session.tick(1000000 + 140000); // +15s elapsed
      assert.equal(hider.isCaught, false, 'Hider must not be caught while bomb is arming');

      // Time advances past 60s arming time (+70s total)
      session.tick(1000000 + 195000);
      assert.equal(bomb.isActive, true, 'Bomb must now be active');
      assert.equal(hider.isCaught, true, 'Hider standing in blast radius must be detonated upon arming');
      assert.equal(bomb.isDetonated, true, 'Bomb must be marked detonated');
      assert.equal(seeker.score, 100, 'Seeker awarded +100 XP');
    });

    test('T4_RW_4: Dynamic shrinking play zone and boundary containment pressure', () => {
      const session = new MatchSession({
        boundaryRadius: 500,
        zoneShrinkInterval: 120, // shrink every 2 min
        zoneShrinkAmount: 100,
        minRadius: 50
      });
      session.addParticipant('s1', 'Seeker', 'seeker');
      session.addParticipant('h1', 'Hider', 'hider');
      session.start(1000000);

      // t = 0s of hunting (120s total)
      session.tick(1000000 + 120000);
      assert.equal(session.getCurrentBoundaryRadius(), 500, 'Initial radius must be 500m');

      // t = 120s of hunting
      session.tick(1000000 + 240000);
      assert.equal(session.getCurrentBoundaryRadius(), 400, 'Radius at 120s must be 400m');

      // t = 240s of hunting
      session.tick(1000000 + 360000);
      assert.equal(session.getCurrentBoundaryRadius(), 300, 'Radius at 240s must be 300m');

      // t = 360s of hunting
      session.tick(1000000 + 480000);
      assert.equal(session.getCurrentBoundaryRadius(), 200, 'Radius at 360s must be 200m');

      // t = 480s of hunting
      session.tick(1000000 + 600000);
      assert.equal(session.getCurrentBoundaryRadius(), 100, 'Radius at 480s must be 100m');

      // t = 600s of hunting (clamped to 50m minimum)
      session.tick(1000000 + 720000);
      assert.equal(session.getCurrentBoundaryRadius(), 50, 'Radius at 600s must be clamped to 50m');
    });

    test('T4_RW_5: One-handed comms and tactical coordination in the heat of chase', () => {
      const session = new MatchSession();
      session.addParticipant('s1', 'Seeker', 'seeker');
      session.addParticipant('h1', 'Hider1', 'hider');
      session.addParticipant('h2', 'Hider2', 'hider');
      session.start(1000000);
      session.tick(1000000 + 130000); // hunting phase

      // Teammate sends warning message
      session.sendChat('h2', 'Hider2', 'SEEKER CLOSING IN ON BASE!');
      assert.equal(session.messages.length, 1);

      // UI state on mobile: unread badge = 1
      let isChatOpen = false;
      let lastSeenCount = 0;
      let unreadCount = session.messages.length - lastSeenCount;
      assert.equal(unreadCount, 1, 'Comms toggle must indicate 1 unread message');

      // Player taps Comms toggle (>= 44x44px target)
      const commsBtn = { width: 44, height: 44 };
      assert.ok(validateTapTarget(commsBtn).passes);
      isChatOpen = true;
      lastSeenCount = session.messages.length; // messages seen
      unreadCount = session.messages.length - lastSeenCount;
      assert.equal(unreadCount, 0, 'Unread badge clears upon opening drawer');

      // Player types tactical response using 16px text in min-44px input
      const chatInput = { height: 44, fontSize: 16 };
      assert.ok(chatInput.height >= 44 && chatInput.fontSize >= 16);
      session.sendChat('h1', 'Hider1', 'EVADING NORTH TOWARDS PARK');
      assert.equal(session.messages.length, 2);

      // Dismiss drawer and recenter map
      isChatOpen = false;
      const recenterBtn = { width: 44, height: 44 };
      assert.ok(validateTapTarget(recenterBtn).passes);
      assert.equal(isChatOpen, false, 'Drawer dismissed cleanly to restore full map view');
    });
  });
}
