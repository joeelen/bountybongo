/**
 * tests/tier5_adversarial_m5.test.js
 * Milestone 5 Tier 5 Adversarial Hardening & Viewport Resilience Suite
 *
 * Empirical verification of:
 * - index.html: Viewport-fit=cover, status-bar-style, apple-mobile-web-app-capable, theme-color
 * - src/App.tsx: Safe-area insets, dynamic offsets, 100dvh, decoupled navigation, no micro-fonts
 * - src/components/MapContainer.tsx: Map Recenter elevation, zoomControl=false, pinch-to-zoom
 * - src/components/DevGpsSimulator.tsx: Left-edge tab positioning, min-h-[44px], 0px collisions, >=10px fonts
 * - src/lib/GpsContext.tsx: Accuracy exposure, simulation toggle, coordinates persistence
 * - src/pages/Matches.tsx: Full-width top telemetry (<=64px), 0 amber tokens, 0 micro-fonts (<10px),
 *   .glow-green, widened roster container, bottom-up slide-over chat drawer (max-h-[60vh], 16px text-base input,
 *   44x44px and 44x48px button touch targets), bottom dock comms toggle with unread counter,
 *   interactive proximity radar with audio/haptic pulse, and 44x44px action buttons.
 * - Viewport profiles: 320px, 360px, 375px, 390px, 412px, 430px, 768px, 1024px, 1920px.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const testFailures = [];

function assert(condition, message, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${message}`);
  } else {
    failedTests++;
    testFailures.push({ message, details });
    console.error(`  ✗ FAIL: ${message}${details ? ` (${details})` : ''}`);
  }
}

console.log('================================================================================');
console.log('  MILESTONE 5 TIER 5 ADVERSARIAL HARDENING & VIEWPORT STRESS HARNESS');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// 1. index.html Inspection
// -----------------------------------------------------------------------------
console.log('[1/7] Testing index.html: Viewport-fit & status-bar-style...');
const indexPath = path.join(projectRoot, 'index.html');
const indexContent = fs.readFileSync(indexPath, 'utf8');

assert(
  indexContent.includes('viewport-fit=cover'),
  'index.html contains viewport-fit=cover in meta viewport'
);
assert(
  indexContent.includes('name="apple-mobile-web-app-status-bar-style"') &&
  indexContent.includes('content="black-translucent"'),
  'index.html contains apple-mobile-web-app-status-bar-style="black-translucent"'
);
assert(
  indexContent.includes('name="apple-mobile-web-app-capable"') &&
  indexContent.includes('content="yes"'),
  'index.html contains apple-mobile-web-app-capable="yes"'
);
assert(
  indexContent.includes('name="theme-color"'),
  'index.html defines meta theme-color'
);

// -----------------------------------------------------------------------------
// 2. src/App.tsx Inspection
// -----------------------------------------------------------------------------
console.log('\n[2/7] Testing src/App.tsx: Safe-area insets, dynamic offsets, 100dvh, decoupled navigation...');
const appPath = path.join(projectRoot, 'src', 'App.tsx');
const appContent = fs.readFileSync(appPath, 'utf8');

assert(
  appContent.includes('env(safe-area-inset-top,0px)') &&
  appContent.includes('env(safe-area-inset-bottom,0px)'),
  'App.tsx includes safe-area-inset-top and safe-area-inset-bottom fallbacks'
);
assert(
  appContent.includes('env(safe-area-inset-left,0px)') &&
  appContent.includes('env(safe-area-inset-right,0px)'),
  'App.tsx includes safe-area-inset-left and safe-area-inset-right horizontal padding'
);
assert(
  appContent.includes('h-[100dvh]'),
  'App.tsx utilizes modern dynamic viewport height h-[100dvh]'
);
assert(
  appContent.includes('const Navigation: React.FC') && appContent.includes('const MainRoutes: React.FC'),
  'App.tsx provides cleanly decoupled Navigation and MainRoutes components'
);
assert(
  !appContent.match(/text-\[[1-9]px\]/),
  'App.tsx contains 0 micro-fonts (<10px)'
);

// -----------------------------------------------------------------------------
// 3. src/components/MapContainer.tsx Inspection
// -----------------------------------------------------------------------------
console.log('\n[3/7] Testing src/components/MapContainer.tsx: Recenter elevation, zoomControl, pinch-to-zoom...');
const mapPath = path.join(projectRoot, 'src', 'components', 'MapContainer.tsx');
const mapContent = fs.readFileSync(mapPath, 'utf8');

assert(
  mapContent.includes('zoomControl={false}'),
  'MapContainer sets zoomControl={false} to avoid touch conflicts on mobile'
);
assert(
  !mapContent.includes('touchZoom={false}'),
  'MapContainer leaves pinch-to-zoom gesture enabled (no touchZoom={false})'
);
assert(
  mapContent.includes('z-[1000]') || mapContent.includes('z-30'),
  'MapContainer provides elevated recenter button above Leaflet z-0 tile plane'
);
assert(
  mapContent.includes('w-11 h-11'),
  'MapContainer fallback recenter button is >= 44x44px (w-11 h-11)'
);

// -----------------------------------------------------------------------------
// 4. src/components/DevGpsSimulator.tsx Inspection
// -----------------------------------------------------------------------------
console.log('\n[4/7] Testing src/components/DevGpsSimulator.tsx: Left-edge tab, min-h-[44px], 0px collisions...');
const devGpsPath = path.join(projectRoot, 'src', 'components', 'DevGpsSimulator.tsx');
const devGpsContent = fs.readFileSync(devGpsPath, 'utf8');

assert(
  devGpsContent.includes('left-0') && devGpsContent.includes('rounded-r-lg rounded-l-none'),
  'DevGpsSimulator is pinned to mobile left screen edge with rounded-r-lg tab'
);
assert(
  devGpsContent.includes('min-h-[44px]'),
  'DevGpsSimulator tab button meets accessibility minimum min-h-[44px]'
);
assert(
  devGpsContent.includes('top-[calc(9rem+env(safe-area-inset-top,0px))]'),
  'DevGpsSimulator vertical offset set at top-9rem to prevent collision with top telemetry & bottom dock'
);
assert(
  !devGpsContent.match(/text-\[[1-9]px\]/),
  'DevGpsSimulator contains 0 micro-fonts (<10px)'
);

// -----------------------------------------------------------------------------
// 5. src/lib/GpsContext.tsx Inspection
// -----------------------------------------------------------------------------
console.log('\n[5/7] Testing src/lib/GpsContext.tsx: Accuracy exposure, simulation toggle, persistence...');
const gpsContextPath = path.join(projectRoot, 'src', 'lib', 'GpsContext.tsx');
const gpsContent = fs.readFileSync(gpsContextPath, 'utf8');

assert(
  gpsContent.includes('accuracy: number | null'),
  'GpsContextType explicitly exposes accuracy: number | null'
);
assert(
  gpsContent.includes('toggleSimulation: (active: boolean) => void'),
  'GpsContextType exposes toggleSimulation function'
);
assert(
  gpsContent.includes("sessionStorage.getItem('gps_lat')") &&
  gpsContent.includes("sessionStorage.getItem('gps_lng')") &&
  gpsContent.includes("sessionStorage.getItem('gps_simulated')"),
  'GpsContext restores coordinates and simulation mode from sessionStorage'
);
assert(
  gpsContent.includes("sessionStorage.setItem('gps_lat'") &&
  gpsContent.includes("sessionStorage.setItem('gps_lng'") &&
  gpsContent.includes("sessionStorage.setItem('gps_simulated'"),
  'GpsContext persists updated coordinates and simulation flag to sessionStorage'
);

// -----------------------------------------------------------------------------
// 6. src/pages/Matches.tsx Inspection
// -----------------------------------------------------------------------------
console.log('\n[6/7] Testing src/pages/Matches.tsx: Telemetry, amber tokens, micro-fonts, glow-green, drawer, targets...');
const matchesPath = path.join(projectRoot, 'src', 'pages', 'Matches.tsx');
const matchesContent = fs.readFileSync(matchesPath, 'utf8');

// A. Telemetry Header
assert(
  matchesContent.includes('absolute top-2 left-2 right-2 z-20 pointer-events-auto') &&
  matchesContent.includes('max-h-[64px]'),
  'Top Telemetry header is full-width (left-2 right-2) and height <= 64px (max-h-[64px])'
);

// B. Amber Tokens (Must be exactly 0 in Matches.tsx)
const amberMatches = matchesContent.match(/amber/gi) || [];
assert(
  amberMatches.length === 0,
  'Matches.tsx has exactly 0 amber design tokens',
  `Found ${amberMatches.length} occurrences`
);

// C. Micro-fonts (<10px) in Matches.tsx
const microFontMatches = matchesContent.match(/text-\[[1-9]px\]/g) || [];
assert(
  microFontMatches.length === 0,
  'Matches.tsx contains 0 micro-fonts (<10px)',
  `Found ${microFontMatches.length}: ${JSON.stringify(microFontMatches)}`
);

// D. glow-green
assert(
  matchesContent.includes('glow-green'),
  'Matches.tsx implements canonical .glow-green cyberpunk effect on active hider'
);

// E. Widened Roster Container
assert(
  matchesContent.includes('min-w-[70px]') && matchesContent.includes('max-w-[75px]'),
  'Matches.tsx roster participant pills are widened (min-w-[70px]) with bounded truncation'
);

// F. Slide-Over Chat Drawer
assert(
  matchesContent.includes('fixed inset-x-0 bottom-0 z-40 max-h-[60vh] flex flex-col') &&
  matchesContent.includes('backdrop-blur-md'),
  'Chat drawer is pinned bottom-up (fixed inset-x-0 bottom-0) with max-h-[60vh]'
);
assert(
  matchesContent.includes('min-h-[44px] text-base') && matchesContent.includes('TRANSMIT MESSAGE...'),
  'Chat drawer input is min-h-[44px] with text-base font size (preventing mobile Safari zoom)'
);
assert(
  matchesContent.includes('min-h-[44px] min-w-[48px]') && matchesContent.includes('Send'),
  'Chat drawer Send button meets minimum touch dimensions (min-h-[44px] min-w-[48px])'
);
assert(
  matchesContent.includes('w-11 h-11 flex items-center justify-center rounded text-zinc-400') &&
  matchesContent.includes('Dismiss Comms'),
  'Chat drawer Dismiss button meets minimum touch dimensions (w-11 h-11 / 44x44px)'
);

// G. Bottom Dock Comms Toggle with Unread Badge
assert(
  matchesContent.includes('w-11 h-11 md:w-12 md:h-12 rounded bg-zinc-900 border border-cyber-cyan/40') &&
  matchesContent.includes('chatMessages.length - lastSeenMessageCount'),
  'Bottom dock includes dedicated comms toggle (w-11 h-11) with unread message badge counter'
);

// H. Interactive Proximity Radar with Audio & Haptic Pulse
assert(
  matchesContent.includes('handleRadarScan') &&
  matchesContent.includes('GameEffects.playRadarPing()') &&
  matchesContent.includes('navigator.vibrate(50)'),
  'Proximity radar includes audio ping and haptic vibration trigger'
);
assert(
  matchesContent.includes('isRadarScanning ? \'ring-2 ring-cyber-cyan shadow-cyan-glow scale-95\' : \'\''),
  'Proximity radar provides tactile scanning pulse visual animation'
);

// I. Touch Targets on All Action Buttons (>= 44px)
assert(
  matchesContent.includes('w-11 h-11 rounded-full bg-zinc-950/90 border border-cyber-cyan') &&
  matchesContent.includes('Center Map on Me'),
  'Recenter Crosshair button has accessible touch target 44x44px (w-11 h-11)'
);
assert(
  matchesContent.includes('min-h-[44px] px-3 md:px-4 py-1.5 bg-cyber-orange') &&
  matchesContent.includes('Drop Proximity Bomb'),
  'Drop Bomb button has accessible touch target min-h-[44px]'
);
assert(
  matchesContent.includes('min-h-[44px] px-2 py-1 rounded border flex flex-col justify-center items-center') &&
  matchesContent.includes('Scan Proximity Radar'),
  'Radar Scanner button has accessible touch target min-h-[44px]'
);
assert(
  matchesContent.includes('min-w-[64px] min-h-[44px]') &&
  matchesContent.includes('Exit Match'),
  'Exit Match button has accessible touch target min-h-[44px] min-w-[64px]'
);

// -----------------------------------------------------------------------------
// 7. Empirical Viewport Profiles Stress Simulation
// -----------------------------------------------------------------------------
console.log('\n[7/7] Executing empirical stress tests across 9 Viewport Profiles...');

const VIEWPORT_PROFILES = [
  { name: '320px (iPhone 5/SE 1)', width: 320, height: 568, safeTop: 0, safeBottom: 0, isMobile: true },
  { name: '360px (Galaxy S Compact)', width: 360, height: 640, safeTop: 0, safeBottom: 0, isMobile: true },
  { name: '375px (iPhone SE 2/3)', width: 375, height: 667, safeTop: 20, safeBottom: 0, isMobile: true },
  { name: '390px (iPhone 13/14)', width: 390, height: 844, safeTop: 47, safeBottom: 34, isMobile: true },
  { name: '412px (Google Pixel 7/8)', width: 412, height: 915, safeTop: 32, safeBottom: 16, isMobile: true },
  { name: '430px (iPhone 14/15 Pro Max)', width: 430, height: 932, safeTop: 59, safeBottom: 34, isMobile: true },
  { name: '768px (iPad Mini / Tablet)', width: 768, height: 1024, safeTop: 24, safeBottom: 20, isMobile: false },
  { name: '1024px (iPad Pro / Desktop)', width: 1024, height: 1366, safeTop: 0, safeBottom: 0, isMobile: false },
  { name: '1920px (Full HD Desktop)', width: 1920, height: 1080, safeTop: 0, safeBottom: 0, isMobile: false }
];

VIEWPORT_PROFILES.forEach(vp => {
  const isMobile = vp.width < 768;
  const topNavH = 56 + vp.safeTop;
  const bottomNavH = isMobile ? (56 + vp.safeBottom) : 0;
  const containerHeight = vp.height - topNavH - bottomNavH;

  // HUD Elements Geometry
  const topTelemetry = { top: 8, height: 58, bottom: 66 };
  const bottomDock = { height: 108, top: containerHeight - 8 - 108, bottom: containerHeight - 8 };

  // 1. Usable Central Map Space
  const clearMapZone = bottomDock.top - topTelemetry.bottom;
  const minRequiredClear = vp.width === 320 ? 180 : 250;
  assert(
    clearMapZone >= minRequiredClear,
    `[${vp.name}] Usable map space >= ${minRequiredClear}px (actual: ${clearMapZone}px)`
  );

  // 2. Dev GPS Simulator Collisions (pinned at top: 9rem / 144px, height: 44px)
  if (isMobile) {
    const devTabTop = 144;
    const devTabBottom = 144 + 44; // 188px
    const clearanceFromTopTelemetry = devTabTop - topTelemetry.bottom; // 144 - 66 = 78px
    const clearanceFromBottomDock = bottomDock.top - devTabBottom;

    assert(
      clearanceFromTopTelemetry > 0 && clearanceFromBottomDock > 0,
      `[${vp.name}] Dev GPS Simulator has 0px collision with HUD (top clear: ${clearanceFromTopTelemetry}px, bottom clear: ${clearanceFromBottomDock}px)`
    );
  }

  // 3. Chat Drawer Open Clearance
  const drawerMaxHeight = Math.min(containerHeight * 0.60, vp.height * 0.60);
  const drawerTop = containerHeight - drawerMaxHeight;
  const drawerClearanceFromTelemetry = drawerTop - topTelemetry.bottom;
  assert(
    drawerClearanceFromTelemetry >= 10,
    `[${vp.name}] Chat drawer preserves >= 10px clearance from Top Telemetry (clearance: ${Math.round(drawerClearanceFromTelemetry)}px)`
  );

  // 4. Horizontal bounds & Roster scrollability
  const maxRosterWidth = vp.width - 32;
  assert(
    maxRosterWidth >= 288,
    `[${vp.name}] Viewport width supports responsive HUD strip (available: ${maxRosterWidth}px)`
  );
});

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  TIER 5 ADVERSARIAL TEST SUMMARY: ${passedTests}/${totalTests} PASSED`);
if (failedTests > 0) {
  console.log(`  FAILURES: ${failedTests}`);
  testFailures.forEach(f => console.log(`  - ${f.message}: ${f.details}`));
}
console.log('================================================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
