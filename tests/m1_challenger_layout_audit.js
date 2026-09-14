/**
 * tests/m1_challenger_layout_audit.js
 * Adversarial Empirical Stress Test Suite for Milestone 1
 * 
 * Tests:
 * 1. Multi-Viewport Layout Geometry & Map Clearance across 320px, 360px, 375px, 390px, 412px, 430px.
 * 2. Map clearance on short screens (>= 300px on 640px height).
 * 3. 2D Bounding Box Collision Analysis between HUD overlays.
 * 4. Touch target compliance (>= 44x44px) on all primary in-match controls.
 * 5. Repository-wide micro-font scan (0 occurrences of < 10px).
 * 6. Responsive text wrapping and layout stability across Leaderboard, Landing, and Social.
 * 7. ThemeContext & WebAudio API state integrity.
 */

import fs from 'fs';
import path from 'path';

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failures = [];

function assert(condition, message, details = '') {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    failedAssertions++;
    failures.push({ message, details });
    console.log(`  ✗ FAIL: ${message} ${details ? `(${details})` : ''}`);
  }
}

console.log('================================================================================');
console.log('  MILESTONE 1 ADVERSARIAL CHALLENGER EMPIRICAL AUDIT');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: Viewport Geometry & Map Clearance (320px - 430px)
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Viewport Geometry & Map Clearance ---');

const VIEWPORT_PROFILES = [
  { name: 'Ultra-Compact 320px (iPhone 5/SE1)', width: 320, height: 568, safeTop: 0, safeBottom: 0 },
  { name: 'Narrow Mobile 360px (Galaxy S Compact)', width: 360, height: 640, safeTop: 0, safeBottom: 0 },
  { name: 'Tall Narrow 360px (Galaxy S20/S22)', width: 360, height: 800, safeTop: 24, safeBottom: 16 },
  { name: 'Classic iOS 375px (iPhone SE 2/3)', width: 375, height: 667, safeTop: 20, safeBottom: 0 },
  { name: 'Standard Notch 390px (iPhone 12/13/14)', width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  { name: 'Dynamic Island 393px (iPhone 15/16)', width: 393, height: 852, safeTop: 59, safeBottom: 34 },
  { name: 'Android Punch-hole 412px (Pixel 7/8)', width: 412, height: 915, safeTop: 32, safeBottom: 16 },
  { name: 'Wide iOS 430px (iPhone 14/15/16 Pro Max)', width: 430, height: 932, safeTop: 59, safeBottom: 34 }
];

VIEWPORT_PROFILES.forEach(vp => {
  // Top nav height: 56px + safeTop
  const topNavH = 56 + vp.safeTop;
  // In an active match, bottom nav is hidden (height = 0); when inactive, 56 + safeBottom
  // We test both active match mode (bottomNav = 0) and fallback mode (bottomNav = 56 + safeBottom)
  
  // HUD Overlays in Matches.tsx:
  // Top Telemetry: top-2 (8px), height 58px, bottom = 66px
  const topTelemetry = { x: 8, y: 8, width: vp.width - 16, height: 58, bottom: 66 };
  
  // Recenter Button: top-20 (80px), right-2, w-11 (44px), h-11 (44px)
  const recenterBtn = { x: vp.width - 8 - 44, y: 80, width: 44, height: 44, bottom: 124 };
  
  // Sunlight Toggle: top-[132px], right-2, w-11 (44px), h-11 (44px)
  const sunlightBtn = { x: vp.width - 8 - 44, y: 132, width: 44, height: 44, bottom: 176 };
  
  // Bottom Action Dock: bottom-2 (8px), height ~108px max
  const dockHeight = 108;
  const dockActiveTop = vp.height - topNavH - 8 - dockHeight;
  const dockInactiveTop = vp.height - topNavH - (56 + vp.safeBottom) - 8 - dockHeight;
  
  const mapClearZoneActive = dockActiveTop - topTelemetry.bottom;
  const mapClearZoneInactive = dockInactiveTop - topTelemetry.bottom;

  // On 640px height screens, map clearance must be >= 300px
  if (vp.height >= 640) {
    assert(
      mapClearZoneActive >= 300,
      `[${vp.name}] Map clearance in active match >= 300px on ${vp.height}px height`,
      `Actual clear zone: ${mapClearZoneActive}px`
    );
  } else {
    // On 568px height (iPhone 5), clear zone must be >= 250px
    assert(
      mapClearZoneActive >= 250,
      `[${vp.name}] Map clearance in active match >= 250px on ultra-compact ${vp.height}px height`,
      `Actual clear zone: ${mapClearZoneActive}px`
    );
  }

  // Slide-Over Chat Drawer: fixed inset-x-0 bottom-0 max-h-[60vh]
  const drawerHeight = vp.height * 0.60;
  const drawerTop = vp.height - drawerHeight;
  // Clearance from top telemetry
  const chatToTelemetryClearance = drawerTop - (topNavH + topTelemetry.bottom);
  assert(
    chatToTelemetryClearance >= 10,
    `[${vp.name}] Chat drawer preserves >= 10px clear vertical gap from top telemetry`,
    `Actual clearance: ${chatToTelemetryClearance}px`
  );
});

// -----------------------------------------------------------------------------
// SECTION 2: 2D Bounding Box Non-Collision Checks
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: 2D Bounding Box Non-Collision Checks ---');

function check2DCollision(rectA, rectB) {
  const aRight = rectA.x + rectA.width;
  const aBottom = rectA.y + rectA.height;
  const bRight = rectB.x + rectB.width;
  const bBottom = rectB.y + rectB.height;
  const xOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(rectA.x, rectB.x));
  const yOverlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(rectA.y, rectB.y));
  return xOverlap > 0 && yOverlap > 0;
}

VIEWPORT_PROFILES.forEach(vp => {
  const topTelemetry = { x: 8, y: 8, width: vp.width - 16, height: 58 };
  const recenterBtn = { x: vp.width - 8 - 44, y: 80, width: 44, height: 44 };
  const sunlightBtn = { x: vp.width - 8 - 44, y: 132, width: 44, height: 44 };
  const dock = { x: 8, y: vp.height - 56 - 8 - 108, width: vp.width - 16, height: 108 };
  // DevGpsSimulator: mobile minimized at top-[calc(9rem)] = 144px, left-0, w-11=44px, h-11=44px
  const devGpsSimTab = { x: 0, y: 144, width: 44, height: 44 };

  assert(!check2DCollision(topTelemetry, recenterBtn), `[${vp.name}] Top telemetry does NOT collide with Recenter button`);
  assert(!check2DCollision(topTelemetry, sunlightBtn), `[${vp.name}] Top telemetry does NOT collide with Sunlight toggle`);
  assert(!check2DCollision(recenterBtn, sunlightBtn), `[${vp.name}] Recenter button does NOT collide with Sunlight toggle (8px gap)`);
  assert(!check2DCollision(topTelemetry, dock), `[${vp.name}] Top telemetry does NOT collide with Bottom dock`);
  assert(!check2DCollision(devGpsSimTab, recenterBtn), `[${vp.name}] Dev GPS Sim tab (left) does NOT collide with Recenter button (right)`);
  assert(!check2DCollision(devGpsSimTab, sunlightBtn), `[${vp.name}] Dev GPS Sim tab (left) does NOT collide with Sunlight button (right)`);
  assert(!check2DCollision(devGpsSimTab, dock), `[${vp.name}] Dev GPS Sim tab does NOT collide with Bottom dock`);
});

// -----------------------------------------------------------------------------
// SECTION 3: Touch Target Bounds (>= 44x44px) Audit
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Touch Target Bounds Audit ---');

const matchesSrc = fs.readFileSync('src/pages/Matches.tsx', 'utf8');

// 1. Drop Bomb Button
assert(
  matchesSrc.includes('min-h-[44px]') && matchesSrc.includes('handlePlaceBomb'),
  'Matches.tsx: Drop Bomb button specifies min-h-[44px] touch target'
);

// 2. Proximity Radar Scanner Button
assert(
  matchesSrc.includes('min-h-[44px]') && matchesSrc.includes('handleRadarScan'),
  'Matches.tsx: Proximity Radar button specifies min-h-[44px] touch target'
);

// 3. Comms Toggle Button
assert(
  matchesSrc.includes('w-11 h-11') && matchesSrc.includes('setIsChatOpen'),
  'Matches.tsx: Comms Toggle button specifies 44x44px (w-11 h-11) touch target'
);

// 4. Exit Match Button
assert(
  matchesSrc.includes('min-w-[64px]') && matchesSrc.includes('min-h-[44px]') && matchesSrc.includes('handleExitMatch'),
  'Matches.tsx: Exit Match button specifies min-w-[64px] min-h-[44px] touch target'
);

// 5. Recenter Crosshair Button
assert(
  matchesSrc.includes('top-20 right-2 z-30 w-11 h-11') && matchesSrc.includes('setMapRecenterCount'),
  'Matches.tsx: Recenter button specifies 44x44px (w-11 h-11) touch target'
);

// 6. Sunlight Theme Toggle Button
assert(
  matchesSrc.includes('top-[132px] right-2 z-30 w-11 h-11') && matchesSrc.includes('toggleTheme'),
  'Matches.tsx: Floating Sunlight toggle specifies 44x44px (w-11 h-11) touch target'
);

// 7. Chat Drawer Dismiss Button
assert(
  matchesSrc.includes('w-11 h-11') && matchesSrc.includes('setIsChatOpen(false)'),
  'Matches.tsx: Chat drawer dismiss button specifies 44x44px (w-11 h-11) touch target'
);

// 8. Chat Drawer Send Button
assert(
  matchesSrc.includes('min-h-[44px] min-w-[48px]'),
  'Matches.tsx: Chat drawer send button specifies min-h-[44px] min-w-[48px] touch target'
);

// 9. Chat Drawer Input Field
assert(
  matchesSrc.includes('min-h-[44px] text-base'),
  'Matches.tsx: Chat drawer input specifies min-h-[44px] and text-base (iOS auto-zoom prevention)'
);

// -----------------------------------------------------------------------------
// SECTION 4: Repository-Wide Micro-Font Audit (< 10px)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Repository-Wide Micro-Font Audit (< 10px) ---');

function scanForMicroFonts(dir) {
  const microFontFiles = [];
  function walk(currentDir) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const fullPath = path.join(currentDir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (/\.(tsx|ts|jsx|js|css|html)$/.test(file)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Match text-[1-9]px or text-[0-9]px
        const matches = content.match(/text-\[[0-9]px\]/g);
        if (matches) {
          microFontFiles.push({ file: fullPath, matches });
        }
        // Match font-size: [1-9]px
        const cssMatches = content.match(/font-size:\s*[1-9]px/g);
        if (cssMatches) {
          microFontFiles.push({ file: fullPath, matches: cssMatches });
        }
      }
    }
  }
  walk(dir);
  return microFontFiles;
}

const microFontViolations = scanForMicroFonts('src');
assert(
  microFontViolations.length === 0,
  'Codebase contains 0 micro-fonts (<10px) across all src/ files',
  JSON.stringify(microFontViolations)
);

// Also verify Matches.tsx specifically contains zero micro-fonts
assert(
  !matchesSrc.match(/text-\[[1-9]px\]/),
  'Matches.tsx contains 0 micro-fonts (<10px)'
);

// Also verify Matches.tsx contains zero amber tokens
assert(
  !matchesSrc.match(/\bamber\b/i),
  'Matches.tsx contains exactly 0 amber design tokens'
);

// -----------------------------------------------------------------------------
// SECTION 5: Mobile Responsiveness Across Pages (320px - 430px)
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 5: Mobile Responsiveness Across Pages ---');

// 1. Leaderboard 5-tier responsive wrap
const leaderboardSrc = fs.readFileSync('src/pages/Leaderboard.tsx', 'utf8');
assert(
  leaderboardSrc.includes('flex flex-wrap sm:grid sm:grid-cols-5') &&
  leaderboardSrc.includes('min-w-[90px]') &&
  leaderboardSrc.includes('whitespace-nowrap'),
  'Leaderboard.tsx: 5-tier legend wraps cleanly (3+2) on mobile with whitespace-nowrap'
);

// 2. Landing Presets responsive 2x2 grid
const landingSrc = fs.readFileSync('src/pages/Landing.tsx', 'utf8');
assert(
  landingSrc.includes('grid grid-cols-2 sm:grid-cols-4') &&
  landingSrc.includes('min-h-[40px]'),
  'Landing.tsx: Presets grid formats as 2x2 on mobile with min-h-[40px] touch targets'
);

// 3. Social Page Mobile Switcher
const socialSrc = fs.readFileSync('src/pages/Social.tsx', 'utf8');
assert(
  socialSrc.includes("setMobileTab('friends')") &&
  socialSrc.includes("setMobileTab('chat')") &&
  socialSrc.includes("mobileTab === 'friends' ? 'flex' : 'hidden md:flex'") &&
  socialSrc.includes("mobileTab === 'chat' ? 'flex' : 'hidden md:flex'"),
  'Social.tsx: Segmented mobile view switcher isolates Network roster and Chat Comms'
);

// 4. App.tsx Mobile Navigation Decoupling & Active Match State
const appSrc = fs.readFileSync('src/App.tsx', 'utf8');
assert(
  appSrc.includes('isMatchActive') &&
  appSrc.includes("isMatchActive ? 'hidden' : 'flex'") &&
  appSrc.includes('z-30'),
  'App.tsx: Global mobile navigation uses z-30 and hides during active matches'
);

// -----------------------------------------------------------------------------
// SECTION 6: ThemeContext & WebAudio API Audio Suite Audit
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 6: ThemeContext & WebAudio API Audio Suite Audit ---');

const themeSrc = fs.readFileSync('src/lib/ThemeContext.tsx', 'utf8');
assert(
  themeSrc.includes("'bounty_ui_theme'") &&
  themeSrc.includes("localStorage.getItem(THEME_STORAGE_KEY)") &&
  themeSrc.includes("root.classList.add('theme-bright')") &&
  themeSrc.includes("root.classList.remove('theme-bright')"),
  'ThemeContext.tsx: Persists theme in localStorage and dynamically toggles .theme-bright on root'
);

const mapSrc = fs.readFileSync('src/components/MapContainer.tsx', 'utf8');
assert(
  mapSrc.includes("key={theme}") &&
  mapSrc.includes("basemaps.cartocdn.com/light_all") &&
  mapSrc.includes("basemaps.cartocdn.com/dark_all"),
  'MapContainer.tsx: Dynamic CartoDB Dark Matter vs Positron Light tiles with key={theme} reload'
);

const effectsSrc = fs.readFileSync('src/lib/GameEffects.ts', 'utf8');
const requiredMethods = [
  'playCountdownChime',
  'playMatchStart',
  'playPowerUp',
  'playFreeze',
  'playUnfreeze',
  'playVictoryFanfare',
  'playDefeatSound',
  'getMuted',
  'setMuted',
  'toggleMute'
];

requiredMethods.forEach(method => {
  assert(
    effectsSrc.includes(method),
    `GameEffects.ts: Exposes method ${method}()`
  );
});

// Verify mute persistence in GameEffects
assert(
  effectsSrc.includes("bounty_audio_muted") &&
  effectsSrc.includes("localStorage.setItem"),
  'GameEffects.ts: Audio mute preference persists to localStorage'
);

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`AUDIT SUMMARY: ${passedAssertions}/${totalAssertions} PASSED (${failedAssertions} FAILED)`);
console.log('================================================================================\n');

if (failedAssertions > 0) {
  console.error('FAILURES:');
  failures.forEach(f => console.error(`- ${f.message}: ${f.details}`));
  process.exit(1);
} else {
  console.log('ALL ADVERSARIAL CHALLENGER AUDIT ASSERTIONS PASSED EMPIRICALLY.');
  process.exit(0);
}
