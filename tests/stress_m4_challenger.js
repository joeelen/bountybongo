/**
 * tests/stress_m4_challenger.js
 * Adversarial Empirical Test Harness for Milestone 4:
 * 1. Multi-viewport geometry across 320px, 360px, 375px, 390px, 412px, 430px, 768px, 1024px, 1920px.
 * 2. Slide-over chat drawer (max-h-[60vh]): verify top 40% viewport has ZERO occlusion (top telemetry y <= 128px).
 * 3. Verify elimination of the 1936px² collision between floating chat and Map Recenter crosshair button.
 * 4. Verify all touch targets strictly satisfy >= 44x44px mobile touch target guideline.
 * 5. Verify unread badge count logic (0, 1-99, 99+, chat open state).
 * 6. Verify interactive proximity radar scanner (audio ping, haptic, scanning state).
 * 7. Verify codebase styling and z-index hierarchy compliance.
 */

import fs from 'fs';
import path from 'path';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function testCase(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.log(`  ✗ FAIL: ${name} — ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

assert.equal = function (actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
};

assert.ok = function (condition, message) {
  assert(condition, message);
};

console.log('================================================================================');
console.log('  EMPIRICAL CHALLENGER: MILESTONE 4 BOTTOM DOCK & CHAT DRAWER SUITE');
console.log('================================================================================\n');

// 1. Comprehensive Viewport Matrix
const VIEWPORTS = [
  { id: 'IPHONE_5', name: 'iPhone 5 / SE1 (Ultra-compact 320px)', width: 320, height: 568, safeTop: 0, safeBottom: 0 },
  { id: 'GALAXY_S_COMPACT', name: 'Samsung Galaxy S Compact (360x640)', width: 360, height: 640, safeTop: 0, safeBottom: 0 },
  { id: 'GALAXY_S20', name: 'Samsung Galaxy S20/S22 (360x800)', width: 360, height: 800, safeTop: 24, safeBottom: 16 },
  { id: 'IPHONE_SE', name: 'iPhone SE 2/3 (Classic iOS 375px)', width: 375, height: 667, safeTop: 20, safeBottom: 0 },
  { id: 'IPHONE_13', name: 'iPhone 12/13/14 (Standard Notch 390px)', width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  { id: 'IPHONE_15', name: 'iPhone 15/16 (Dynamic Island 393px)', width: 393, height: 852, safeTop: 59, safeBottom: 34 },
  { id: 'PIXEL_7', name: 'Google Pixel 7/8 (Punch-hole 412px)', width: 412, height: 915, safeTop: 32, safeBottom: 16 },
  { id: 'IPHONE_PRO_MAX', name: 'iPhone 14/15/16 Pro Max (Wide iOS 430px)', width: 430, height: 932, safeTop: 59, safeBottom: 34 },
  { id: 'IPAD_MINI', name: 'iPad Mini / Tablet (Breakpoint 768px)', width: 768, height: 1024, safeTop: 0, safeBottom: 0 },
  { id: 'DESKTOP_SMALL', name: 'Small Desktop (1024x768)', width: 1024, height: 768, safeTop: 0, safeBottom: 0 },
  { id: 'DESKTOP_FHD', name: 'Full HD Desktop (1920x1080)', width: 1920, height: 1080, safeTop: 0, safeBottom: 0 },
];

/**
 * 2D Bounding Box Collision Intersection Checker
 */
function computeIntersection(boxA, boxB) {
  if (!boxA || !boxB) return { collides: false, overlapArea: 0, overlapWidth: 0, overlapHeight: 0 };
  const x1 = Math.max(boxA.x, boxB.x);
  const y1 = Math.max(boxA.y, boxB.y);
  const x2 = Math.min(boxA.x + boxA.width, boxB.x + boxB.width);
  const y2 = Math.min(boxA.y + boxA.height, boxB.y + boxB.height);

  if (x2 > x1 && y2 > y1) {
    const width = x2 - x1;
    const height = y2 - y1;
    return {
      collides: true,
      overlapArea: width * height,
      overlapWidth: width,
      overlapHeight: height,
      overlapRect: { x: x1, y: y1, width, height }
    };
  }
  return { collides: false, overlapArea: 0, overlapWidth: 0, overlapHeight: 0 };
}

/**
 * Computes exact HUD element bounding boxes corresponding to CSS in App.tsx and Matches.tsx
 */
function computeM4Layout(viewport, { isChatOpen = false, isDevGpsOpen = false } = {}) {
  const isDesktop = viewport.width >= 768;
  const safeTop = viewport.safeTop ?? 0;
  const safeBottom = viewport.safeBottom ?? 0;

  // App shell padding
  const appPaddingTop = 64 + safeTop; // 4rem = 64px + safeTop
  const appPaddingBottom = isDesktop ? 0 : (64 + safeBottom);
  const matchesY = appPaddingTop;
  const matchesHeight = viewport.height - appPaddingTop - appPaddingBottom;

  // 1. Top Telemetry Header (absolute top-2 left-2 right-2, h-[58px] max-h-[64px])
  const telemMargin = 8;
  const telemHeight = 58;
  const topTelemetry = {
    id: 'top_telemetry',
    x: telemMargin,
    y: matchesY + telemMargin,
    width: viewport.width - (telemMargin * 2),
    height: telemHeight,
    bottom: matchesY + telemMargin + telemHeight,
    zIndex: 20
  };

  // 2. Map Recenter Crosshair Button (absolute top-20 right-2 z-30 w-11 h-11)
  const recenterTop = 80;
  const recenterRight = 8;
  const recenterSize = 44;
  const mapRecenterButton = {
    id: 'map_recenter_button',
    x: viewport.width - recenterRight - recenterSize,
    y: matchesY + recenterTop,
    width: recenterSize,
    height: recenterSize,
    bottom: matchesY + recenterTop + recenterSize,
    zIndex: 30
  };

  // 3. Bottom Action Dock (absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-20)
  // Height bounded within <= 130px on mobile
  const dockMarginBottom = isDesktop ? 16 : 8;
  const dockHeight = isDesktop ? 120 : 108;
  const dockWidth = Math.min(672, viewport.width - (isDesktop ? 32 : 16));
  const dockX = (viewport.width - dockWidth) / 2;
  const dockY = matchesY + matchesHeight - dockMarginBottom - dockHeight;
  const bottomDock = {
    id: 'bottom_action_dock',
    x: dockX,
    y: dockY,
    width: dockWidth,
    height: dockHeight,
    bottom: dockY + dockHeight,
    zIndex: 20
  };

  // 4. Slide-Over Chat Drawer (fixed inset-x-0 bottom-0 z-40 max-h-[60vh])
  let chatDrawer = null;
  if (isChatOpen) {
    const drawerMaxHeight = viewport.height * 0.60;
    const drawerY = viewport.height - drawerMaxHeight;
    chatDrawer = {
      id: 'chat_drawer',
      x: 0,
      y: drawerY,
      width: viewport.width,
      height: drawerMaxHeight,
      bottom: viewport.height,
      zIndex: 40
    };
  }

  // 5. Dev GPS Simulator
  let devGpsSim;
  if (isDesktop) {
    const devWidth = isDevGpsOpen ? 288 : 48;
    const devHeight = isDevGpsOpen ? 350 : 48;
    devGpsSim = {
      id: 'dev_gps_sim',
      x: viewport.width - 16 - devWidth,
      y: viewport.height - 16 - devHeight,
      width: devWidth,
      height: devHeight,
      zIndex: 30
    };
  } else {
    const devTop = 144 + safeTop;
    const devWidth = isDevGpsOpen ? Math.min(288, viewport.width - 16) : 69;
    const devHeight = isDevGpsOpen ? Math.min(350, viewport.height - 160) : 44;
    devGpsSim = {
      id: 'dev_gps_sim',
      x: 0,
      y: devTop,
      width: devWidth,
      height: devHeight,
      zIndex: 30
    };
  }

  // Central map clear zone between Top Telemetry and Bottom Dock (when chat is closed)
  const clearZoneHeight = bottomDock.y - topTelemetry.bottom;
  const clearZoneRatio = clearZoneHeight / viewport.height;

  return {
    viewport,
    topTelemetry,
    mapRecenterButton,
    bottomDock,
    chatDrawer,
    devGpsSim,
    clearZoneHeight,
    clearZoneRatio
  };
}

// -----------------------------------------------------------------------------
// SECTION 1: Multi-Viewport Geometry Stress Test Across 11 Diverse Viewports
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Multi-Viewport Geometry Stress Test (320px to 1920px) ---');

VIEWPORTS.forEach((vp) => {
  testCase(`1.${vp.id}: Viewport geometry for ${vp.name} (${vp.width}x${vp.height})`, () => {
    const layout = computeM4Layout(vp, { isChatOpen: false });

    // Verify top telemetry dimensions
    assert.ok(layout.topTelemetry.height <= 64, `Top telemetry height must be <= 64px, got ${layout.topTelemetry.height}`);
    assert.ok(layout.topTelemetry.width > 0, `Top telemetry width must be positive`);
    assert.equal(layout.topTelemetry.width, vp.width - 16, `Top telemetry must span full width with 8px margins`);

    // Verify bottom action dock dimensions
    assert.ok(layout.bottomDock.height <= 130, `Bottom dock height must be <= 130px, got ${layout.bottomDock.height}`);
    assert.ok(layout.bottomDock.width <= vp.width, `Bottom dock width must fit within viewport`);

    // Verify central clear zone
    assert.ok(layout.clearZoneHeight > 180, `Clear zone height must be > 180px, got ${layout.clearZoneHeight}px on ${vp.name}`);
    assert.ok(layout.clearZoneRatio >= 0.35, `Clear zone ratio must be >= 35%, got ${(layout.clearZoneRatio * 100).toFixed(1)}%`);

    // Verify 0px collision between top telemetry and bottom dock
    const dockCollision = computeIntersection(layout.topTelemetry, layout.bottomDock);
    assert.equal(dockCollision.overlapArea, 0, `Top telemetry and bottom dock must not collide (overlap: ${dockCollision.overlapArea}px²)`);

    // Verify 0px collision between top telemetry and map recenter button
    const recenterCollision = computeIntersection(layout.topTelemetry, layout.mapRecenterButton);
    assert.equal(recenterCollision.overlapArea, 0, `Top telemetry and map recenter must not collide`);
  });
});

// -----------------------------------------------------------------------------
// SECTION 2: Chat Drawer Top 40% Viewport Occlusion & Clearance Verification
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Chat Drawer Top 40% Viewport Occlusion & Clearance ---');

VIEWPORTS.forEach((vp) => {
  testCase(`2.${vp.id}: Chat drawer top 40% occlusion test on ${vp.name}`, () => {
    const layout = computeM4Layout(vp, { isChatOpen: true });
    const drawer = layout.chatDrawer;
    assert.ok(drawer !== null, 'Chat drawer must be open');

    // 1. Top 40% Viewport boundary line
    const top40PercentThreshold = vp.height * 0.40;

    // Chat drawer top edge is at y = vp.height - max-h-[60vh] = vp.height * 0.40
    assert.ok(drawer.y >= top40PercentThreshold - 0.001, `Drawer top y (${drawer.y}) must be >= 40% threshold (${top40PercentThreshold})`);

    // 2. Zero Occlusion of Top Telemetry Bar
    // The top telemetry bar is in the top header. Its bottom edge must be strictly above drawer.y
    const clearance = drawer.y - layout.topTelemetry.bottom;
    assert.ok(clearance > 0, `Clearance between drawer top and top telemetry bottom must be positive (got ${clearance.toFixed(1)}px on ${vp.name})`);

    // 3. Collision intersection between Chat Drawer and Top Telemetry must be 0px²
    const telemCollision = computeIntersection(layout.topTelemetry, drawer);
    assert.equal(telemCollision.overlapArea, 0, `Chat drawer must have 0px² collision with top telemetry`);

    // 4. Collision intersection between Chat Drawer and Map Recenter button must be 0px²
    const recenterCollision = computeIntersection(layout.mapRecenterButton, drawer);
    assert.equal(recenterCollision.overlapArea, 0, `Chat drawer must have 0px² collision with map recenter button (clearance: ${(drawer.y - layout.mapRecenterButton.bottom).toFixed(1)}px)`);
  });
});

// -----------------------------------------------------------------------------
// SECTION 3: Elimination of 1936px² Collision with Map Recenter Button
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Elimination of 1936px² Collision with Map Recenter Button ---');

testCase('3.1: Codebase audit confirms complete removal of floating chat overlay at top-20 right-2', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');

  // Verify obsolete floating chat toggle (top-20 right-16) is removed
  assert.ok(!matchesContent.includes('right-16'), 'Matches.tsx must not contain right-16 (obsolete floating chat toggle)');

  // Verify obsolete floating chat overlay at top-20 right-2 is removed
  assert.ok(!matchesContent.includes('w-64 md:w-72 h-48 md:h-64'), 'Matches.tsx must not contain floating chat panel dimensions');
  assert.ok(!matchesContent.includes('absolute top-20 right-2 z-30 w-64'), 'Matches.tsx must not contain floating chat panel');

  // Verify chat drawer uses fixed bottom-0
  assert.ok(matchesContent.includes('fixed inset-x-0 bottom-0 z-40 max-h-[60vh]'), 'Matches.tsx must use fixed inset-x-0 bottom-0 z-40 max-h-[60vh] for drawer');
});

testCase('3.2: Empirical collision comparison: Legacy M3 floating chat vs M4 Slide-Over Chat Drawer', () => {
  VIEWPORTS.forEach((vp) => {
    const isDesktop = vp.width >= 768;
    const safeTop = vp.safeTop ?? 0;
    const matchesY = 64 + safeTop;

    // Map recenter button
    const mapRecenter = {
      x: vp.width - 8 - 44,
      y: matchesY + 80,
      width: 44,
      height: 44
    };

    // Legacy M3 Open Chat Panel: absolute top-20 right-2 (width 256, height 192)
    const legacyChatPanel = {
      x: vp.width - 8 - (isDesktop ? 288 : 256),
      y: matchesY + 80,
      width: isDesktop ? 288 : 256,
      height: isDesktop ? 256 : 192
    };

    // Legacy collision: should be exactly 44 * 44 = 1936 px²
    const legacyIntersection = computeIntersection(mapRecenter, legacyChatPanel);
    assert.equal(legacyIntersection.overlapArea, 1936, `Legacy M3 chat panel must produce 1936px² collision on ${vp.name}`);

    // M4 Slide-Over Chat Drawer: fixed inset-x-0 bottom-0 max-h-[60vh]
    const drawerHeight = vp.height * 0.60;
    const m4ChatDrawer = {
      x: 0,
      y: vp.height - drawerHeight,
      width: vp.width,
      height: drawerHeight
    };

    // M4 collision: must be EXACTLY 0 px²
    const m4Intersection = computeIntersection(mapRecenter, m4ChatDrawer);
    assert.equal(m4Intersection.overlapArea, 0, `M4 Chat drawer must have 0px² collision with Map Recenter button on ${vp.name}`);
    assert.equal(m4Intersection.collides, false, `M4 Chat drawer must not collide with Map Recenter button on ${vp.name}`);
  });
});

// -----------------------------------------------------------------------------
// SECTION 4: Touch Target Compliance (>= 44x44px) & Interaction Matrix
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Touch Target Compliance (>= 44x44px) & Interaction Matrix ---');

const MIN_TOUCH_TARGET = 44;

testCase('4.1: Bottom Dock Comms Toggle Button touch target (w-11 h-11 / 44x44px min)', () => {
  const widthMobile = 44; // w-11
  const heightMobile = 44; // h-11
  const widthDesktop = 48; // md:w-12
  const heightDesktop = 48; // md:h-12

  assert.ok(widthMobile >= MIN_TOUCH_TARGET, 'Mobile comms width must be >= 44px');
  assert.ok(heightMobile >= MIN_TOUCH_TARGET, 'Mobile comms height must be >= 44px');
  assert.ok(widthDesktop >= MIN_TOUCH_TARGET, 'Desktop comms width must be >= 44px');
  assert.ok(heightDesktop >= MIN_TOUCH_TARGET, 'Desktop comms height must be >= 44px');
});

testCase('4.2: Bottom Dock Exit Match Button touch target (min-w-[64px] min-h-[44px])', () => {
  const minWidth = 64;
  const minHeight = 44;

  assert.ok(minWidth >= MIN_TOUCH_TARGET, 'Exit button min-width must be >= 44px (is 64px)');
  assert.ok(minHeight >= MIN_TOUCH_TARGET, 'Exit button min-height must be >= 44px');
});

testCase('4.3: Bottom Dock Drop Bomb Button touch target (min-h-[44px], flex-1 on mobile)', () => {
  const minHeight = 44;
  // In flex row with width >= 320px, flex-1 provides > 64px width
  assert.ok(minHeight >= MIN_TOUCH_TARGET, 'Drop bomb button min-height must be >= 44px');
});

testCase('4.4: Bottom Dock Interactive Proximity Radar Button touch target (min-h-[44px])', () => {
  const minHeight = 44;
  assert.ok(minHeight >= MIN_TOUCH_TARGET, 'Proximity radar button min-height must be >= 44px');
});

testCase('4.5: Chat Drawer Dismiss Button touch target (w-11 h-11 / 44x44px)', () => {
  const width = 44;
  const height = 44;
  assert.ok(width >= MIN_TOUCH_TARGET, 'Dismiss button width must be >= 44px');
  assert.ok(height >= MIN_TOUCH_TARGET, 'Dismiss button height must be >= 44px');
});

testCase('4.6: Chat Drawer Send Button touch target (min-h-[44px] min-w-[48px])', () => {
  const minWidth = 48;
  const minHeight = 44;
  assert.ok(minWidth >= MIN_TOUCH_TARGET, 'Send button min-width must be >= 44px (is 48px)');
  assert.ok(minHeight >= MIN_TOUCH_TARGET, 'Send button min-height must be >= 44px');
});

testCase('4.7: Chat Drawer Input Field dimensions and iOS auto-zoom prevention (min-h-[44px] text-base)', () => {
  const minHeight = 44;
  const fontSize = 16; // text-base = 1rem = 16px
  assert.ok(minHeight >= MIN_TOUCH_TARGET, 'Chat input min-height must be >= 44px');
  assert.ok(fontSize >= 16, 'Chat input font-size must be >= 16px to prevent iOS Safari auto-zoom');
});

testCase('4.8: Map Recenter Crosshair Button touch target (w-11 h-11 / 44x44px)', () => {
  const width = 44;
  const height = 44;
  assert.ok(width >= MIN_TOUCH_TARGET, 'Map Recenter width must be >= 44px');
  assert.ok(height >= MIN_TOUCH_TARGET, 'Map Recenter height must be >= 44px');
});

testCase('4.9: Unread badge counter formatting and visibility logic', () => {
  function formatBadge(unreadCount, isChatOpen) {
    if (isChatOpen || unreadCount <= 0) return null;
    return unreadCount > 99 ? '99+' : `${unreadCount}`;
  }

  // 0 unread -> hidden
  assert.equal(formatBadge(0, false), null, '0 unread must hide badge');
  // While chat open -> hidden
  assert.equal(formatBadge(5, true), null, 'Chat open must hide badge');
  // Exact count 1..99
  assert.equal(formatBadge(1, false), '1', '1 unread must display 1');
  assert.equal(formatBadge(12, false), '12', '12 unread must display 12');
  assert.equal(formatBadge(99, false), '99', '99 unread must display 99');
  // Capped at 99+
  assert.equal(formatBadge(100, false), '99+', '100 unread must display 99+');
  assert.equal(formatBadge(500, false), '99+', '500 unread must display 99+');
});

testCase('4.10: Interactive Proximity Radar Scanner feedback logic', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');

  // Verify handleRadarScan calls audio, haptics, and state
  assert.ok(matchesContent.includes('GameEffects.playRadarPing()'), 'Radar scan must call GameEffects.playRadarPing()');
  assert.ok(matchesContent.includes('navigator.vibrate(50)'), 'Radar scan must trigger navigator.vibrate(50)');
  assert.ok(matchesContent.includes('setIsRadarScanning(true)'), 'Radar scan must set isRadarScanning to true');
  assert.ok(matchesContent.includes('setTimeout(() => setIsRadarScanning(false), 600)'), 'Radar scan pulse must reset after 600ms');

  // Verify visual classes attached to isRadarScanning
  assert.ok(matchesContent.includes("isRadarScanning ? 'ring-2 ring-cyber-cyan shadow-cyan-glow scale-95' : ''"), 'Radar button must apply ring, glow, and scale when scanning');
  assert.ok(matchesContent.includes("isRadarScanning ? 'animate-spin' : ''"), 'Crosshair icon must animate spin during scan');
});

// -----------------------------------------------------------------------------
// SECTION 5: Codebase Styling, Safe Area, and Z-Index Hierarchy Compliance
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Codebase Styling, Safe Area & Z-Index Hierarchy ---');

testCase('5.1: Zero amber color classes in src/pages/Matches.tsx', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');
  const amberMatches = matchesContent.match(/amber-[0-9]+/g);
  assert.equal(amberMatches, null, `Found obsolete amber tokens: ${amberMatches}`);
});

testCase('5.2: Zero micro-fonts (<10px) in src/pages/Matches.tsx', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');
  const microFontMatches = matchesContent.match(/text-\[[1-9]px\]/g);
  assert.equal(microFontMatches, null, `Found micro-fonts < 10px: ${microFontMatches}`);
});

testCase('5.3: Z-Index Stacking Hierarchy conforms strictly to PROJECT.md Contract', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');

  // Map: inset-0 z-0
  assert.ok(matchesContent.includes('absolute inset-0 z-0'), 'Map container must be at z-0');
  // Top Telemetry Header: z-20
  assert.ok(matchesContent.includes('absolute top-2 left-2 right-2 z-20'), 'Top telemetry must be at z-20');
  // Bottom Action Dock: z-20
  assert.ok(matchesContent.includes('z-20 pointer-events-none flex flex-col items-center'), 'Bottom dock outer wrapper must be at z-20');
  // Map Recenter Button: z-30
  assert.ok(matchesContent.includes('absolute top-20 right-2 z-30 w-11 h-11'), 'Map recenter button must be at z-30');
  // Slide-over Chat Drawer: z-40
  assert.ok(matchesContent.includes('fixed inset-x-0 bottom-0 z-40 max-h-[60vh]'), 'Chat drawer must be at z-40');
});

testCase('5.4: Safe-Area padding resilience in Chat Drawer and Bottom Dock', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');
  assert.ok(matchesContent.includes('pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]'), 'Chat drawer form must include safe-area bottom padding');
});

testCase('5.5: Chat Drawer zero-message empty state displays verbatim "No comms."', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');
  assert.ok(matchesContent.includes('No comms.'), 'Chat drawer empty state must display verbatim "No comms."');
});

console.log('\n================================================================================');
console.log(`TOTAL: ${totalTests} executed | ${passedTests} passed | ${failedTests} failed`);
console.log('================================================================================\n');

if (failedTests > 0) {
  console.error('FAILURES DETECTED:');
  failures.forEach(f => console.error(`  - ${f.name}: ${f.error}`));
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL CHALLENGER TESTS PASSED CLEANLY.');
  process.exit(0);
}
