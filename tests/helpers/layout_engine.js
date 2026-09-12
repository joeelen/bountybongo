/**
 * tests/helpers/layout_engine.js
 * Headless mobile viewport layout geometry engine & collision checker.
 * Evaluates overlay bounding boxes, tap target compliance, safe-area insets, and clear-zone visibility
 * across standard mobile screen dimensions (360px to 430px).
 */

export const MOBILE_VIEWPORTS = {
  SAMSUNG_S20: { name: 'Samsung Galaxy S20/S22', width: 360, height: 800, safeTop: 24, safeBottom: 16 },
  IPHONE_SE: { name: 'iPhone SE / Mini', width: 375, height: 667, safeTop: 20, safeBottom: 0 },
  IPHONE_13: { name: 'iPhone 12/13/14', width: 390, height: 844, safeTop: 47, safeBottom: 34 },
  IPHONE_15: { name: 'iPhone 15/16', width: 393, height: 852, safeTop: 59, safeBottom: 34 },
  PIXEL_7: { name: 'Google Pixel 7/8', width: 412, height: 915, safeTop: 32, safeBottom: 16 },
  IPHONE_PRO_MAX: { name: 'iPhone 14/15/16 Pro Max', width: 430, height: 932, safeTop: 59, safeBottom: 34 }
};

export const MIN_TOUCH_TARGET = 44; // 44px x 44px mobile accessibility threshold

/**
 * Calculates in-match HUD overlay bounding boxes for a given viewport and state.
 */
export function computeHudLayout(viewport, state = {}) {
  const { isChatOpen = false, isGpsSimOpen = false } = state;
  const safeTop = viewport.safeTop ?? 0;
  const safeBottom = viewport.safeBottom ?? 0;

  // Fixed Navigation heights
  const topNav = {
    id: 'top_nav',
    x: 0,
    y: 0,
    width: viewport.width,
    height: 56 + safeTop
  };

  const bottomNav = {
    id: 'bottom_nav',
    x: 0,
    y: viewport.height - (56 + safeBottom),
    width: viewport.width,
    height: 56 + safeBottom
  };

  // Top Telemetry Header (pinned below top nav: absolute top-2 left-2 right-2)
  const topTelemetryMargin = 8;
  const topTelemetryHeight = 64; // Max bounded mobile height
  const topTelemetry = {
    id: 'top_telemetry',
    x: topTelemetryMargin,
    y: topNav.height + topTelemetryMargin,
    width: viewport.width - (topTelemetryMargin * 2),
    height: topTelemetryHeight,
    bottom: topNav.height + topTelemetryMargin + topTelemetryHeight
  };

  // Bottom Action Dock (pinned above bottom nav: absolute bottom-2 left-2 right-2)
  const bottomDockMargin = 8;
  const bottomDockHeight = 130; // Max bounded mobile height
  const bottomDockY = bottomNav.y - bottomDockMargin - bottomDockHeight;
  const bottomActionDock = {
    id: 'bottom_action_dock',
    x: bottomDockMargin,
    y: bottomDockY,
    width: viewport.width - (bottomDockMargin * 2),
    height: bottomDockHeight,
    bottom: bottomDockY + bottomDockHeight
  };

  // Slide-Over Chat Drawer (fixed inset-x-0 bottom-0, max-h-[60vh])
  let chatDrawer = null;
  if (isChatOpen) {
    const drawerHeight = Math.min(viewport.height * 0.60, 480);
    chatDrawer = {
      id: 'chat_drawer',
      x: 0,
      y: viewport.height - drawerHeight,
      width: viewport.width,
      height: drawerHeight,
      bottom: viewport.height
    };
  }

  // Floating Map Recenter button (top-20 right-2 or elevated z-[1000])
  const recenterButton = {
    id: 'recenter_button',
    x: viewport.width - 8 - 44,
    y: topTelemetry.bottom + 8,
    width: 44,
    height: 44,
    bottom: topTelemetry.bottom + 8 + 44
  };

  // Repositioned mobile Dev GPS Simulator (top-20 right-2 or above bottom dock)
  const devGpsSim = {
    id: 'dev_gps_sim',
    x: viewport.width - 48 - 8,
    y: topNav.height + 8,
    width: isGpsSimOpen ? 280 : 48,
    height: isGpsSimOpen ? 336 : 48,
    bottom: (topNav.height + 8) + (isGpsSimOpen ? 336 : 48)
  };

  // Map Central Clear Zone: vertical clearance between Top Telemetry and Bottom Dock
  const clearZoneHeight = bottomActionDock.y - topTelemetry.bottom;
  const clearZoneRatio = clearZoneHeight / viewport.height;

  return {
    viewport,
    topNav,
    bottomNav,
    topTelemetry,
    bottomActionDock,
    chatDrawer,
    recenterButton,
    devGpsSim,
    clearZoneHeight,
    clearZoneRatio
  };
}

/**
 * Checks for 2D physical bounding box collision/overlap between two elements.
 */
export function checkCollision(rectA, rectB) {
  if (!rectA || !rectB) return { collides: false, overlapArea: 0 };

  const aRight = rectA.x + rectA.width;
  const aBottom = rectA.y + rectA.height;
  const bRight = rectB.x + rectB.width;
  const bBottom = rectB.y + rectB.height;

  const xOverlap = Math.max(0, Math.min(aRight, bRight) - Math.max(rectA.x, rectB.x));
  const yOverlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(rectA.y, rectB.y));

  const overlapArea = xOverlap * yOverlap;
  return {
    collides: overlapArea > 0,
    overlapArea,
    xOverlap,
    yOverlap
  };
}

/**
 * Validates whether an interactive button meets mobile tap target guidelines (>= 44x44px).
 */
export function validateTapTarget(element) {
  const width = element.width ?? 0;
  const height = element.height ?? 0;
  const passesWidth = width >= MIN_TOUCH_TARGET;
  const passesHeight = height >= MIN_TOUCH_TARGET;
  return {
    width,
    height,
    passes: passesWidth && passesHeight,
    passesWidth,
    passesHeight,
    deficitX: Math.max(0, MIN_TOUCH_TARGET - width),
    deficitY: Math.max(0, MIN_TOUCH_TARGET - height)
  };
}
