/**
/**
 * tests/stress_m2_empirical.test.js
 * Empirical Stress Test Harness for Milestone 2 Layout & Collision Analysis.
 *
 * Adversarially challenges:
 * 1. Viewport geometry across extreme screen widths (320px, 360px, 375px, 390px, 412px, 430px, 768px, 1024px)
 *    and heights (568px, 640px, 667px, 800px, 844px, 915px, 932px).
 * 2. Map Recenter button at `top-20 right-2 z-30` tap accessibility, clearance vs top telemetry, floating chat,
 *    and bottom action dock.
 * 3. DevGpsSimulator at `fixed top-36 right-0 z-30` collision with Recenter button, Top Telemetry, and Bottom Dock.
 */

import fs from 'fs';
import path from 'path';

// Viewport profiles to stress-test
const TEST_VIEWPORTS = [
  { name: 'iPhone 5/SE1 (Ultra-compact)', width: 320, height: 568, safeTop: 0, safeBottom: 0 },
  { name: 'Samsung Galaxy S20/S22 (Narrow Android)', width: 360, height: 800, safeTop: 0, safeBottom: 0 },
  { name: 'Samsung Galaxy S Compact', width: 360, height: 640, safeTop: 0, safeBottom: 0 },
  { name: 'iPhone SE 2/3 (Classic iOS)', width: 375, height: 667, safeTop: 20, safeBottom: 0 },
  { name: 'iPhone 13/14 (Standard Notch)', width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  { name: 'Google Pixel 7 (Punch-hole)', width: 412, height: 915, safeTop: 32, safeBottom: 16 },
  { name: 'iPhone 15/16 Pro Max (Dynamic Island)', width: 430, height: 932, safeTop: 59, safeBottom: 34 },
  { name: 'iPad Mini / Tablet (md breakpoint)', width: 768, height: 1024, safeTop: 0, safeBottom: 0 },
  { name: 'Desktop Full HD', width: 1920, height: 1080, safeTop: 0, safeBottom: 0 },
];

/**
 * 2D Bounding Box Collision
 */
function computeIntersection(boxA, boxB) {
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
 * Model actual DOM positions derived from App.tsx, Matches.tsx, and DevGpsSimulator.tsx
 */
function computeActualDomLayout(viewport, { isChatMinimized = true, isDevGpsMinimized = true } = {}) {
  const isDesktop = viewport.width >= 768;
  const safeTop = viewport.safeTop ?? 0;
  const safeBottom = viewport.safeBottom ?? 0;

  // 1. App Shell Container (src/App.tsx line 110)
  // pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0
  const appPaddingTop = 64 + safeTop; // 4rem = 64px
  const appPaddingBottom = isDesktop ? 0 : (64 + safeBottom);

  // 2. Matches Container (src/pages/Matches.tsx line 730)
  // Inside MainRoutes content box:
  const matchesTopInViewport = appPaddingTop;
  const matchesHeightInViewport = viewport.height - appPaddingTop - appPaddingBottom;

  // 3. Top Telemetry (Matches.tsx line 786)
  // absolute top-2 left-2 md:top-4 md:left-4 w-[180px] md:w-72
  const telemetryMarginTop = isDesktop ? 16 : 8;
  const telemetryMarginLeft = isDesktop ? 16 : 8;
  const telemetryWidth = isDesktop ? 288 : 180;
  const telemetryHeight = isDesktop ? 130 : 110;
  const topTelemetry = {
    id: 'top_telemetry',
    x: telemetryMarginLeft,
    y: matchesTopInViewport + telemetryMarginTop,
    width: telemetryWidth,
    height: telemetryHeight
  };

  // 4. Map Recenter Button (Matches.tsx line 776)
  // absolute top-20 right-2 z-30 w-11 h-11
  // top-20 = 80px relative to Matches container
  const recenterTopInMatches = 80;
  const recenterMarginRight = 8;
  const recenterWidth = 44;
  const recenterHeight = 44;
  const mapRecenterButton = {
    id: 'map_recenter_button',
    x: viewport.width - recenterMarginRight - recenterWidth,
    y: matchesTopInViewport + recenterTopInMatches,
    width: recenterWidth,
    height: recenterHeight,
    zIndex: 30
  };

  // 5. Floating Chat (Matches.tsx line 818)
  // If minimized: absolute top-2 right-2 md:top-4 md:right-4 z-10 w-10 h-10 md:w-12 md:h-12
  // If open: absolute top-2 right-2 md:top-4 md:right-4 z-20 w-[180px] md:w-72 h-48 md:h-64
  let floatingChat;
  if (isChatMinimized) {
    const chatSize = isDesktop ? 48 : 40;
    const chatMargin = isDesktop ? 16 : 8;
    floatingChat = {
      id: 'floating_chat_minimized',
      x: viewport.width - chatMargin - chatSize,
      y: matchesTopInViewport + chatMargin,
      width: chatSize,
      height: chatSize,
      zIndex: 10
    };
  } else {
    const chatWidth = isDesktop ? 288 : 180;
    const chatHeight = isDesktop ? 256 : 192;
    const chatMargin = isDesktop ? 16 : 8;
    floatingChat = {
      id: 'floating_chat_open',
      x: viewport.width - chatMargin - chatWidth,
      y: matchesTopInViewport + chatMargin,
      width: chatWidth,
      height: chatHeight,
      zIndex: 20
    };
  }

  // 6. Bottom Action Dock (Matches.tsx line 877)
  // absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4
  const dockMarginBottom = isDesktop ? 16 : 8;
  const dockMarginX = isDesktop ? 16 : 8;
  const dockHeight = isDesktop ? 140 : 115;
  const bottomDock = {
    id: 'bottom_action_dock',
    x: dockMarginX,
    y: matchesTopInViewport + matchesHeightInViewport - dockMarginBottom - dockHeight,
    width: viewport.width - (dockMarginX * 2),
    height: dockHeight,
    zIndex: 10
  };

  // 7. DevGpsSimulator (src/components/DevGpsSimulator.tsx line 66)
  // fixed top-36 right-0 md:top-auto md:bottom-4 md:right-4 z-30
  // Note: position is FIXED, so coordinates are relative to VIEWPORT (not Matches container)!
  let devGpsSimulator;
  if (isDesktop) {
    // Desktop: bottom-4 right-4
    const devWidth = isDevGpsMinimized ? 48 : 288;
    const devHeight = isDevGpsMinimized ? 48 : 350;
    devGpsSimulator = {
      id: isDevGpsMinimized ? 'dev_gps_sim_desktop_min' : 'dev_gps_sim_desktop_open',
      x: viewport.width - 16 - devWidth,
      y: viewport.height - 16 - devHeight,
      width: devWidth,
      height: devHeight,
      zIndex: 30
    };
  } else {
    // Mobile: fixed top-36 right-0
    // top-36 = 144px from viewport top (NOT Matches top!)
    const devTop = 144;
    const devWidth = isDevGpsMinimized ? 66 : Math.min(288, viewport.width - 16);
    const devHeight = isDevGpsMinimized ? 44 : Math.min(350, viewport.height - 160);
    devGpsSimulator = {
      id: isDevGpsMinimized ? 'dev_gps_sim_mobile_min' : 'dev_gps_sim_mobile_open',
      x: viewport.width - devWidth, // right-0
      y: devTop,
      width: devWidth,
      height: devHeight,
      zIndex: 30
    };
  }

  return {
    viewport,
    appPaddingTop,
    appPaddingBottom,
    matchesTopInViewport,
    matchesHeightInViewport,
    topTelemetry,
    mapRecenterButton,
    floatingChat,
    bottomDock,
    devGpsSimulator
  };
}

console.log('='.repeat(80));
console.log('  EMPIRICAL STRESS TEST REPORT: MILESTONE 2 GEOMETRY & COLLISIONS');
console.log('='.repeat(80));

let failures = [];

// TEST 1: Extreme Viewport Geometry
console.log('\n[SECTION 1] Viewport Geometry across Extreme Screen Sizes:');
for (const vp of TEST_VIEWPORTS) {
  const layout = computeActualDomLayout(vp);
  const clearHeight = layout.bottomDock.y - (layout.topTelemetry.y + layout.topTelemetry.height);
  const clearPercent = ((clearHeight / vp.height) * 100).toFixed(1);
  const isHealthy = clearHeight >= 180;
  console.log(`  - ${vp.name} (${vp.width}x${vp.height}): Clear map zone = ${clearHeight}px (${clearPercent}%) -> ${isHealthy ? 'OK' : 'FAIL'}`);
  if (!isHealthy) {
    failures.push(`Clear map space too constrained on ${vp.name}: only ${clearHeight}px`);
  }
}

// TEST 2: Map Recenter button collisions
console.log('\n[SECTION 2] Map Recenter Button Tap Collisions:');
for (const vp of TEST_VIEWPORTS) {
  // Case A: Chat Minimized
  const layoutMinChat = computeActualDomLayout(vp, { isChatMinimized: true });
  const colTelem = computeIntersection(layoutMinChat.mapRecenterButton, layoutMinChat.topTelemetry);
  const colDock = computeIntersection(layoutMinChat.mapRecenterButton, layoutMinChat.bottomDock);
  const colChatMin = computeIntersection(layoutMinChat.mapRecenterButton, layoutMinChat.floatingChat);

  console.log(`  [${vp.name}] When Chat Minimized:`);
  console.log(`    - Collision with Top Telemetry: ${colTelem.collides ? `COLLISION (${colTelem.overlapArea}px²)` : 'NONE (OK)'}`);
  console.log(`    - Collision with Bottom Dock:   ${colDock.collides ? `COLLISION (${colDock.overlapArea}px²)` : 'NONE (OK)'}`);
  console.log(`    - Collision with Minimized Chat:${colChatMin.collides ? `COLLISION (${colChatMin.overlapArea}px²)` : 'NONE (OK, 32px vertical gap)'}`);

  if (colTelem.collides) failures.push(`Recenter collides with telemetry on ${vp.name}`);
  if (colDock.collides) failures.push(`Recenter collides with bottom dock on ${vp.name}`);
  if (colChatMin.collides) failures.push(`Recenter collides with minimized chat on ${vp.name}`);

  // Case B: Chat OPEN (Adversarial stress test)
  const layoutOpenChat = computeActualDomLayout(vp, { isChatMinimized: false });
  const colChatOpen = computeIntersection(layoutOpenChat.mapRecenterButton, layoutOpenChat.floatingChat);
  console.log(`  [${vp.name}] When Chat OPEN:`);
  console.log(`    - Collision with Open Chat:     ${colChatOpen.collides ? `CRITICAL COLLISION (${colChatOpen.overlapArea}px² overlap, Recenter z-30 over Chat z-20)` : 'NONE'}`);
  if (colChatOpen.collides) {
    failures.push(`CRITICAL: On ${vp.name}, when chat panel is opened, Map Recenter button at z-30 completely overlaps open chat panel at z-20 (${colChatOpen.overlapArea}px² occlusion)`);
  }
}

// TEST 3: DevGpsSimulator Collisions
console.log('\n[SECTION 3] DevGpsSimulator at top-36 right-0 z-30 Collisions:');
for (const vp of TEST_VIEWPORTS) {
  const layoutMinDev = computeActualDomLayout(vp, { isDevGpsMinimized: true });
  const colRecenter = computeIntersection(layoutMinDev.devGpsSimulator, layoutMinDev.mapRecenterButton);
  const colTelem = computeIntersection(layoutMinDev.devGpsSimulator, layoutMinDev.topTelemetry);
  const colDock = computeIntersection(layoutMinDev.devGpsSimulator, layoutMinDev.bottomDock);

  const isMobile = vp.width < 768;
  console.log(`  [${vp.name} (${isMobile ? 'Mobile' : 'Desktop'})]:`);
  console.log(`    - DevGpsSim Bounding Box: x=[${layoutMinDev.devGpsSimulator.x}, ${layoutMinDev.devGpsSimulator.x + layoutMinDev.devGpsSimulator.width}], y=[${layoutMinDev.devGpsSimulator.y}, ${layoutMinDev.devGpsSimulator.y + layoutMinDev.devGpsSimulator.height}]`);
  console.log(`    - Recenter   Bounding Box: x=[${layoutMinDev.mapRecenterButton.x}, ${layoutMinDev.mapRecenterButton.x + layoutMinDev.mapRecenterButton.width}], y=[${layoutMinDev.mapRecenterButton.y}, ${layoutMinDev.mapRecenterButton.y + layoutMinDev.mapRecenterButton.height}]`);
  console.log(`    - Collision with Recenter Button: ${colRecenter.collides ? `CRITICAL COLLISION: Overlap ${colRecenter.overlapWidth}x${colRecenter.overlapHeight}px (${colRecenter.overlapArea}px²)` : 'NONE'}`);
  console.log(`    - Collision with Top Telemetry:   ${colTelem.collides ? `COLLISION (${colTelem.overlapArea}px²)` : 'NONE'}`);
  console.log(`    - Collision with Bottom Dock:     ${colDock.collides ? `COLLISION (${colDock.overlapArea}px²)` : 'NONE'}`);

  if (colRecenter.collides) {
    failures.push(`CRITICAL COLLISION: DevGpsSimulator at top-36 right-0 overlaps Map Recenter button on ${vp.name} by ${colRecenter.overlapWidth}x${colRecenter.overlapHeight}px (${colRecenter.overlapArea}px²)`);
  }
  if (colTelem.collides) failures.push(`DevGpsSim collides with telemetry on ${vp.name}`);
  if (colDock.collides) failures.push(`DevGpsSim collides with dock on ${vp.name}`);
}

console.log('\n' + '='.repeat(80));
console.log(`SUMMARY: Total empirical challenge failures found = ${failures.length}`);
console.log('='.repeat(80));
failures.forEach((f, idx) => console.log(`${idx + 1}. ${f}`));

process.exit(failures.length > 0 ? 2 : 0);
