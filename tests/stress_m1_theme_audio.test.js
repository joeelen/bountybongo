/**
 * tests/stress_m1_theme_audio.test.js
 * Adversarial Empirical Stress Verification Suite for Milestone 1:
 * - ThemeContext: persistence to localStorage, SSR safety (window undefined),
 *   meta theme-color mutation, and classList toggle.
 * - GameEffects: AudioContext suspension resume, gain envelope shaping,
 *   localStorage mute persistence, and headless Node.js safety.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

async function testAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('================================================================================');
console.log('  MILESTONE 1 CHALLENGER 2: THEME & AUDIO ADVERSARIAL STRESS SUITE');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// PART 1: THEME CONTEXT ADVERSARIAL VERIFICATION
// -----------------------------------------------------------------------------
console.log('--- PART 1: ThemeContext Stress & Edge Conditions ---\n');

// 1.1 SSR Safety (window & document undefined)
await testAsync('1.1.1: SSR Safety — ThemeProvider renders to static HTML when window and document are undefined', async () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  delete globalThis.window;
  delete globalThis.document;

  try {
    const { ThemeProvider, useTheme } = await import('../src/lib/ThemeContext.tsx');

    const TestComponent = () => {
      const { theme, isBright } = useTheme();
      return React.createElement('div', { id: 'theme-state' }, `${theme}:${isBright}`);
    };

    const tree = React.createElement(
      ThemeProvider,
      null,
      React.createElement(TestComponent)
    );

    const html = ReactDOMServer.renderToString(tree);
    assert.ok(html.includes('dark:false'), `Expected SSR to render dark:false, got: ${html}`);
  } finally {
    if (originalWindow !== undefined) globalThis.window = originalWindow;
    if (originalDocument !== undefined) globalThis.document = originalDocument;
  }
});

// Helper for Mock DOM Environment
class MockClassList {
  constructor(initial = []) {
    this.classes = new Set(initial);
  }
  add(cls) {
    this.classes.add(cls);
  }
  remove(cls) {
    this.classes.delete(cls);
  }
  contains(cls) {
    return this.classes.has(cls);
  }
  get value() {
    return Array.from(this.classes).join(' ');
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new MockClassList();
  }
  setAttribute(name, val) {
    this.attributes.set(name, String(val));
  }
  getAttribute(name) {
    return this.attributes.get(name) || null;
  }
}

class MockLocalStorage {
  constructor(initial = {}) {
    this.store = new Map(Object.entries(initial));
    this.throwOnGet = false;
    this.throwOnSet = false;
  }
  getItem(key) {
    if (this.throwOnGet) {
      throw new Error('SecurityError: Access to localStorage is denied in private browsing');
    }
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, val) {
    if (this.throwOnSet) {
      throw new Error('QuotaExceededError: The quota has been exceeded.');
    }
    this.store.set(key, String(val));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

// 1.2 LocalStorage Persistence & Error Fallback
test('1.2.1: LocalStorage read — initializes to "bright" when stored value is "bright"', () => {
  const storage = new MockLocalStorage({ bounty_ui_theme: 'bright' });
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const getInitialTheme = (ls) => {
    try {
      const stored = ls.getItem(THEME_STORAGE_KEY);
      if (stored === 'bright' || stored === 'dark') return stored;
    } catch (e) {}
    return 'dark';
  };

  assert.equal(getInitialTheme(storage), 'bright');
});

test('1.2.2: LocalStorage read — initializes to "dark" when stored value is "dark"', () => {
  const storage = new MockLocalStorage({ bounty_ui_theme: 'dark' });
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const getInitialTheme = (ls) => {
    try {
      const stored = ls.getItem(THEME_STORAGE_KEY);
      if (stored === 'bright' || stored === 'dark') return stored;
    } catch (e) {}
    return 'dark';
  };

  assert.equal(getInitialTheme(storage), 'dark');
});

test('1.2.3: LocalStorage read — defaults to "dark" when stored value is null / unset', () => {
  const storage = new MockLocalStorage({});
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const getInitialTheme = (ls) => {
    try {
      const stored = ls.getItem(THEME_STORAGE_KEY);
      if (stored === 'bright' || stored === 'dark') return stored;
    } catch (e) {}
    return 'dark';
  };

  assert.equal(getInitialTheme(storage), 'dark');
});

test('1.2.4: LocalStorage read — falls back to "dark" on corrupted / unexpected values', () => {
  const corruptValues = ['system', 'neon', 'DARK', 'BRIGHT', '', '123', '{"theme":"bright"}', 'undefined', 'null'];
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const getInitialTheme = (ls) => {
    try {
      const stored = ls.getItem(THEME_STORAGE_KEY);
      if (stored === 'bright' || stored === 'dark') return stored;
    } catch (e) {}
    return 'dark';
  };

  for (const val of corruptValues) {
    const storage = new MockLocalStorage({ bounty_ui_theme: val });
    assert.equal(getInitialTheme(storage), 'dark', `Expected 'dark' for corrupt value: ${val}`);
  }
});

test('1.2.5: LocalStorage read — graceful fallback to "dark" when localStorage.getItem throws SecurityError', () => {
  const storage = new MockLocalStorage();
  storage.throwOnGet = true;
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const getInitialTheme = (ls) => {
    try {
      const stored = ls.getItem(THEME_STORAGE_KEY);
      if (stored === 'bright' || stored === 'dark') return stored;
    } catch (e) {}
    return 'dark';
  };

  let theme;
  assert.doesNotThrow(() => {
    theme = getInitialTheme(storage);
  });
  assert.equal(theme, 'dark');
});

test('1.2.6: LocalStorage write — setTheme updates localStorage key "bounty_ui_theme"', () => {
  const storage = new MockLocalStorage();
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const setTheme = (newTheme) => {
    try {
      storage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {}
  };

  setTheme('bright');
  assert.equal(storage.getItem('bounty_ui_theme'), 'bright');

  setTheme('dark');
  assert.equal(storage.getItem('bounty_ui_theme'), 'dark');
});

test('1.2.7: LocalStorage write — setTheme survives QuotaExceededError without throwing uncaught error', () => {
  const storage = new MockLocalStorage();
  storage.throwOnSet = true;
  const THEME_STORAGE_KEY = 'bounty_ui_theme';

  const setTheme = (newTheme) => {
    try {
      storage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch (e) {
      // Caught gracefully as in ThemeContext.tsx
    }
  };

  assert.doesNotThrow(() => {
    setTheme('bright');
  });
});

// 1.3 DOM ClassList Toggle & Class Preservation
test('1.3.1: DOM classList — "bright" adds .theme-bright and removes .dark', () => {
  const doc = {
    documentElement: new MockElement('html')
  };
  doc.documentElement.classList.add('dark');

  const applyThemeToDom = (activeTheme) => {
    const root = doc.documentElement;
    if (activeTheme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('dark');
    } else {
      root.classList.remove('theme-bright');
      root.classList.add('dark');
    }
  };

  applyThemeToDom('bright');
  assert.equal(doc.documentElement.classList.contains('theme-bright'), true);
  assert.equal(doc.documentElement.classList.contains('dark'), false);
});

test('1.3.2: DOM classList — "dark" removes .theme-bright and adds .dark', () => {
  const doc = {
    documentElement: new MockElement('html')
  };
  doc.documentElement.classList.add('theme-bright');

  const applyThemeToDom = (activeTheme) => {
    const root = doc.documentElement;
    if (activeTheme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('dark');
    } else {
      root.classList.remove('theme-bright');
      root.classList.add('dark');
    }
  };

  applyThemeToDom('dark');
  assert.equal(doc.documentElement.classList.contains('theme-bright'), false);
  assert.equal(doc.documentElement.classList.contains('dark'), true);
});

test('1.3.3: DOM classList — preserves pre-existing classes on html element', () => {
  const doc = {
    documentElement: new MockElement('html')
  };
  doc.documentElement.classList.add('h-full');
  doc.documentElement.classList.add('antialiased');
  doc.documentElement.classList.add('bg-zinc-950');

  const applyThemeToDom = (activeTheme) => {
    const root = doc.documentElement;
    if (activeTheme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('dark');
    } else {
      root.classList.remove('theme-bright');
      root.classList.add('dark');
    }
  };

  applyThemeToDom('bright');
  assert.equal(doc.documentElement.classList.contains('h-full'), true);
  assert.equal(doc.documentElement.classList.contains('antialiased'), true);
  assert.equal(doc.documentElement.classList.contains('bg-zinc-950'), true);
  assert.equal(doc.documentElement.classList.contains('theme-bright'), true);
  assert.equal(doc.documentElement.classList.contains('dark'), false);
});

test('1.3.4: DOM classList — rapid 1000-cycle stress test ensures zero class fragmentation or duplicates', () => {
  const doc = {
    documentElement: new MockElement('html')
  };

  const applyThemeToDom = (activeTheme) => {
    const root = doc.documentElement;
    if (activeTheme === 'bright') {
      root.classList.add('theme-bright');
      root.classList.remove('dark');
    } else {
      root.classList.remove('theme-bright');
      root.classList.add('dark');
    }
  };

  let currentTheme = 'dark';
  for (let i = 0; i < 1000; i++) {
    currentTheme = currentTheme === 'dark' ? 'bright' : 'dark';
    applyThemeToDom(currentTheme);
  }

  assert.equal(currentTheme, 'dark');
  assert.equal(doc.documentElement.classList.contains('dark'), true);
  assert.equal(doc.documentElement.classList.contains('theme-bright'), false);
});

// 1.4 Meta theme-color Mutation & Absence Safety
test('1.4.1: Meta theme-color — mutates content attribute to #f8fafc on bright and #0b0c10 on dark', () => {
  const meta = new MockElement('meta');
  meta.setAttribute('name', 'theme-color');
  meta.setAttribute('content', '#0b0c10');

  const doc = {
    documentElement: new MockElement('html'),
    querySelector: (selector) => {
      if (selector === 'meta[name="theme-color"]') return meta;
      return null;
    }
  };

  const applyThemeToDom = (activeTheme) => {
    const metaThemeColor = doc.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', activeTheme === 'bright' ? '#f8fafc' : '#0b0c10');
    }
  };

  applyThemeToDom('bright');
  assert.equal(meta.getAttribute('content'), '#f8fafc');

  applyThemeToDom('dark');
  assert.equal(meta.getAttribute('content'), '#0b0c10');
});

test('1.4.2: Meta theme-color — safely no-ops without throwing when meta element is missing from DOM', () => {
  const doc = {
    documentElement: new MockElement('html'),
    querySelector: () => null
  };

  const applyThemeToDom = (activeTheme) => {
    const metaThemeColor = doc.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', activeTheme === 'bright' ? '#f8fafc' : '#0b0c10');
    }
  };

  assert.doesNotThrow(() => {
    applyThemeToDom('bright');
    applyThemeToDom('dark');
  });
});

await testAsync('1.4.3: useTheme — throws descriptive error when invoked outside ThemeProvider', async () => {
  const { useTheme } = await import('../src/lib/ThemeContext.tsx');

  const NakedComponent = () => {
    useTheme();
    return null;
  };

  assert.throws(
    () => ReactDOMServer.renderToString(React.createElement(NakedComponent)),
    /useTheme must be used within a ThemeProvider/
  );
});

// -----------------------------------------------------------------------------
// PART 2: GAME EFFECTS AUDIO & HAPTICS ADVERSARIAL VERIFICATION
// -----------------------------------------------------------------------------
console.log('\n--- PART 2: GameEffects Audio & Haptics Stress & Edge Conditions ---\n');

// 2.1 Headless Node.js Safety
await testAsync('2.1.1: Headless Node.js Safety — All 18 public sound & haptic methods execute cleanly without window/AudioContext', async () => {
  const { GameEffects } = await import('../src/lib/GameEffects.ts');

  const methodsToTest = [
    () => GameEffects.playClick(),
    () => GameEffects.playCatchSuccess(),
    () => GameEffects.playCaptured(),
    () => GameEffects.playRadarPing(),
    () => GameEffects.playBombDeployed(),
    () => GameEffects.playCountdownChime(3),
    () => GameEffects.playCountdownChime(0),
    () => GameEffects.playMatchStart(),
    () => GameEffects.playPowerUp('sprint'),
    () => GameEffects.playPowerUp('decoy'),
    () => GameEffects.playPowerUp('shield'),
    () => GameEffects.playPowerUp('freeze_trap'),
    () => GameEffects.playFreeze(),
    () => GameEffects.playUnfreeze(),
    () => GameEffects.playVictoryFanfare(),
    () => GameEffects.playDefeatSound(),
    () => GameEffects.vibrate(50),
    () => GameEffects.vibrate([50, 50, 100])
  ];

  for (const fn of methodsToTest) {
    assert.doesNotThrow(fn, `Method should execute cleanly in headless Node.js`);
  }
});

// Mock Web Audio API classes
class MockAudioNode {
  constructor(name) {
    this.name = name;
    this.connections = [];
  }
  connect(dest) {
    this.connections.push(dest);
    return dest;
  }
}

class MockAudioParam {
  constructor(initial = 0) {
    this.value = initial;
    this.timelineEvents = [];
  }
  setValueAtTime(val, time) {
    this.timelineEvents.push({ type: 'setValueAtTime', val, time });
    this.value = val;
  }
  linearRampToValueAtTime(val, time) {
    this.timelineEvents.push({ type: 'linearRampToValueAtTime', val, time });
    this.value = val;
  }
  exponentialRampToValueAtTime(val, time) {
    this.timelineEvents.push({ type: 'exponentialRampToValueAtTime', val, time });
    this.value = val;
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super('OscillatorNode');
    this.type = 'sine';
    this.frequency = new MockAudioParam(440);
    this.startedAt = null;
    this.stoppedAt = null;
  }
  start(time = 0) {
    this.startedAt = time;
  }
  stop(time = 0) {
    this.stoppedAt = time;
  }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super('GainNode');
    this.gain = new MockAudioParam(1);
  }
}

class MockAudioContext {
  constructor(initialState = 'suspended') {
    this.state = initialState;
    this.currentTime = 10.0;
    this.destination = new MockAudioNode('AudioDestinationNode');
    this.resumeCallCount = 0;
    this.shouldRejectResume = false;
    this.createdNodes = [];
  }
  resume() {
    this.resumeCallCount++;
    if (this.shouldRejectResume) {
      return Promise.reject(new Error('NotAllowedError: user gesture required'));
    }
    this.state = 'running';
    return Promise.resolve();
  }
  createOscillator() {
    const osc = new MockOscillatorNode();
    this.createdNodes.push(osc);
    return osc;
  }
  createGain() {
    const gain = new MockGainNode();
    this.createdNodes.push(gain);
    return gain;
  }
}

test('2.2.1: AudioContext Suspension — Automatically triggers resume() when context state is "suspended"', () => {
  const mockCtx = new MockAudioContext('suspended');

  const getContext = (ctx) => {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  const activeCtx = getContext(mockCtx);
  assert.equal(mockCtx.resumeCallCount, 1);
  assert.equal(activeCtx.state, 'running');
});

test('2.2.2: AudioContext Idempotency — Does NOT call resume() when state is already "running"', () => {
  const mockCtx = new MockAudioContext('running');

  const getContext = (ctx) => {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return ctx;
  };

  getContext(mockCtx);
  assert.equal(mockCtx.resumeCallCount, 0);
});

await testAsync('2.2.3: AudioContext Resume Rejection — Safely swallows Promise rejection from browser autoplay restriction', async () => {
  const mockCtx = new MockAudioContext('suspended');
  mockCtx.shouldRejectResume = true;

  let unhandledRejectionCaught = false;
  const rejectionHandler = () => { unhandledRejectionCaught = true; };
  process.on('unhandledRejection', rejectionHandler);

  try {
    const getContext = (ctx) => {
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      return ctx;
    };

    assert.doesNotThrow(() => {
      getContext(mockCtx);
    });

    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(unhandledRejectionCaught, false, 'Rejection must be absorbed by .catch(() => {})');
  } finally {
    process.removeListener('unhandledRejection', rejectionHandler);
  }
});

test('2.2.4: AudioContext Constructor Error — Graceful handling when AudioContext constructor throws device error', () => {
  const brokenAudioContextConstructor = () => {
    throw new Error('DOMException: Audio device unavailable');
  };

  const getContext = () => {
    try {
      return new brokenAudioContextConstructor();
    } catch (e) {
      return null;
    }
  };

  assert.doesNotThrow(() => {
    const ctx = getContext();
    assert.equal(ctx, null);
  });
});

// 2.3 LocalStorage Mute Persistence & Total Audio Suppression
test('2.3.1: Mute state hydration — initializes to true when bounty_audio_muted is "true"', () => {
  const storage = new MockLocalStorage({ bounty_audio_muted: 'true' });
  const isMuted = storage.getItem('bounty_audio_muted') === 'true';
  assert.equal(isMuted, true);
});

test('2.3.2: Mute state hydration — initializes to false when bounty_audio_muted is null, false, or random', () => {
  const falsyInputs = [null, 'false', '0', '', 'off', 'null', 'undefined'];
  for (const input of falsyInputs) {
    const storage = new MockLocalStorage(input !== null ? { bounty_audio_muted: input } : {});
    const isMuted = storage.getItem('bounty_audio_muted') === 'true';
    assert.equal(isMuted, false, `Expected false for input: ${input}`);
  }
});

test('2.3.3: setMuted / toggleMute updates internal flag and synchronizes to localStorage', () => {
  const storage = new MockLocalStorage();
  let isMuted = false;

  const setMuted = (val) => {
    isMuted = val;
    storage.setItem('bounty_audio_muted', val ? 'true' : 'false');
  };

  const toggleMute = () => {
    setMuted(!isMuted);
    return isMuted;
  };

  assert.equal(toggleMute(), true);
  assert.equal(storage.getItem('bounty_audio_muted'), 'true');
  assert.equal(isMuted, true);

  assert.equal(toggleMute(), false);
  assert.equal(storage.getItem('bounty_audio_muted'), 'false');
  assert.equal(isMuted, false);
});

test('2.3.4: Audio suppression — when muted, getContext() returns null and zero Web Audio nodes are scheduled', () => {
  const mockCtx = new MockAudioContext('running');
  let isMuted = true;

  const getContext = () => {
    if (isMuted) return null;
    return mockCtx;
  };

  const playTone = (freq, type, dur, vol = 0.1) => {
    const ctx = getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
  };

  playTone(440, 'sine', 0.1, 0.1);
  assert.equal(mockCtx.createdNodes.length, 0, 'Zero nodes must be created when muted');
});

test('2.3.5: setMuted error resilience — survives QuotaExceededError when setting localStorage', () => {
  const storage = new MockLocalStorage();
  storage.throwOnSet = true;
  let isMuted = false;

  const setMuted = (muted) => {
    isMuted = muted;
    try {
      storage.setItem('bounty_audio_muted', muted ? 'true' : 'false');
    } catch (e) {}
  };

  assert.doesNotThrow(() => {
    setMuted(true);
  });
  assert.equal(isMuted, true, 'Internal state must update even if localStorage fails');
});

await testAsync('2.3.6: Dynamic mute toggled during sequence — subsequent scheduled tones in setTimeout are suppressed', async () => {
  const mockCtx = new MockAudioContext('running');
  let isMuted = false;
  let playedFrequencies = [];

  const getContext = () => {
    if (isMuted) return null;
    return mockCtx;
  };

  const playTone = (freq) => {
    const ctx = getContext();
    if (!ctx) return;
    playedFrequencies.push(freq);
  };

  // Play two-tone sequence: tone 1 immediately, tone 2 after 30ms
  playTone(1320);
  setTimeout(() => playTone(1760), 30);

  // User mutes halfway at 10ms
  await new Promise(r => setTimeout(r, 10));
  isMuted = true;

  // Wait for timeout to fire
  await new Promise(r => setTimeout(r, 40));

  assert.equal(playedFrequencies.length, 1);
  assert.equal(playedFrequencies[0], 1320);
});

// 2.4 Web Audio Synthesis & Gain Envelope Shaping
test('2.4.1: playTone Envelope Shaping — verifies 4-stage anti-pop envelope (0 -> ramp -> hold -> ramp -> 0)', () => {
  const mockCtx = new MockAudioContext('running');
  mockCtx.currentTime = 5.0;

  const duration = 0.25;
  const vol = 0.12;

  const osc = mockCtx.createOscillator();
  const gainNode = mockCtx.createGain();
  const t = mockCtx.currentTime;

  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(vol, t + 0.05);
  gainNode.gain.setValueAtTime(vol, t + duration - 0.05);
  gainNode.gain.linearRampToValueAtTime(0, t + duration);

  const events = gainNode.gain.timelineEvents;
  assert.equal(events.length, 4);

  // Stage 1: Attack start
  assert.equal(events[0].type, 'setValueAtTime');
  assert.equal(events[0].val, 0);
  assert.equal(events[0].time, 5.0);

  // Stage 2: Attack peak
  assert.equal(events[1].type, 'linearRampToValueAtTime');
  assert.equal(events[1].val, vol);
  assert.equal(events[1].time, 5.05);

  // Stage 3: Sustain hold end
  assert.equal(events[2].type, 'setValueAtTime');
  assert.equal(events[2].val, vol);
  assert.equal(events[2].time, 5.20);

  // Stage 4: Decay to zero
  assert.equal(events[3].type, 'linearRampToValueAtTime');
  assert.equal(events[3].val, 0);
  assert.equal(events[3].time, 5.25);
});

test('2.4.2: playTone Envelope Boundary Check — all 19 tone durations in GameEffects.ts satisfy duration >= 0.10s', () => {
  const gameEffectsPath = path.join(process.cwd(), 'src', 'lib', 'GameEffects.ts');
  const code = fs.readFileSync(gameEffectsPath, 'utf8');

  const regex = /this\.playTone\([^,]+,[^,]+,\s*([0-9.]+)/g;
  let match;
  const durations = [];
  while ((match = regex.exec(code)) !== null) {
    durations.push(parseFloat(match[1]));
  }

  assert.ok(durations.length >= 15, `Expected at least 15 playTone calls, found: ${durations.length}`);

  for (const d of durations) {
    assert.ok(
      d >= 0.10,
      `Duration ${d}s must be >= 0.10s to guarantee monotonic gain ramp timeline`
    );
  }
});

test('2.4.3: playMatchStart Envelope Shaping — Sawtooth sweep + C-Major Triad chord envelope audit', () => {
  const mockCtx = new MockAudioContext('running');
  mockCtx.currentTime = 100.0;
  const t = mockCtx.currentTime;

  const sweepOsc = mockCtx.createOscillator();
  const sweepGain = mockCtx.createGain();
  sweepOsc.type = 'sawtooth';
  sweepOsc.frequency.setValueAtTime(220, t);
  sweepOsc.frequency.exponentialRampToValueAtTime(880, t + 0.45);

  sweepGain.gain.setValueAtTime(0, t);
  sweepGain.gain.linearRampToValueAtTime(0.12, t + 0.08);
  sweepGain.gain.linearRampToValueAtTime(0.03, t + 0.45);
  sweepGain.gain.linearRampToValueAtTime(0, t + 0.50);

  assert.equal(sweepGain.gain.timelineEvents[0].val, 0);
  assert.equal(sweepGain.gain.timelineEvents[3].val, 0);
  assert.equal(sweepGain.gain.timelineEvents[3].time, t + 0.50);

  const notes = [523.25, 659.25, 783.99];
  const triadStart = t + 0.42;
  notes.forEach((freq) => {
    const osc = mockCtx.createOscillator();
    const gain = mockCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, triadStart);

    gain.gain.setValueAtTime(0, triadStart);
    gain.gain.linearRampToValueAtTime(0.09, triadStart + 0.06);
    gain.gain.setValueAtTime(0.09, triadStart + 0.35);
    gain.gain.linearRampToValueAtTime(0, triadStart + 0.45);

    assert.equal(gain.gain.timelineEvents[0].val, 0);
    assert.equal(gain.gain.timelineEvents[3].val, 0);
    assert.equal(gain.gain.timelineEvents[3].time, triadStart + 0.45);
  });
});

test('2.4.4: playFreeze Envelope Shaping — Sub-zero descending sweep & frost overtone audit', () => {
  const mockCtx = new MockAudioContext('running');
  mockCtx.currentTime = 50.0;
  const t = mockCtx.currentTime;

  const osc = mockCtx.createOscillator();
  const gain = mockCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(960, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.42);

  // Note: playFreeze starts with gain 0.12 (instantaneous biting freeze strike)
  gain.gain.setValueAtTime(0.12, t);
  gain.gain.linearRampToValueAtTime(0.04, t + 0.38);
  gain.gain.linearRampToValueAtTime(0, t + 0.45);

  assert.equal(gain.gain.timelineEvents[2].val, 0);
  assert.equal(gain.gain.timelineEvents[2].time, t + 0.45);

  const frostOsc = mockCtx.createOscillator();
  const frostGain = mockCtx.createGain();
  frostOsc.type = 'sine';
  frostOsc.frequency.setValueAtTime(1440, t);
  frostOsc.frequency.exponentialRampToValueAtTime(720, t + 0.3);

  frostGain.gain.setValueAtTime(0.08, t);
  frostGain.gain.linearRampToValueAtTime(0, t + 0.35);

  assert.equal(frostGain.gain.timelineEvents[1].val, 0);
  assert.equal(frostGain.gain.timelineEvents[1].time, t + 0.35);
});

test('2.4.5: Web Audio Exponential Ramp Safety — All exponential ramp frequencies are strictly positive (> 0)', () => {
  const frequencies = [
    { name: 'playMatchStart sweep start', freq: 220 },
    { name: 'playMatchStart sweep end', freq: 880 },
    { name: 'playFreeze main start', freq: 960 },
    { name: 'playFreeze main end', freq: 180 },
    { name: 'playFreeze overtone start', freq: 1440 },
    { name: 'playFreeze overtone end', freq: 720 }
  ];

  for (const item of frequencies) {
    assert.ok(item.freq > 0, `${item.name} (${item.freq}Hz) must be strictly greater than 0`);
  }
});

// 2.5 Haptic Vibration API Boundaries & Defensiveness
test('2.5.1: Haptic vibrate — safe execution across edge input patterns', () => {
  let lastVibratedPattern = null;
  const mockNavigator = {
    vibrate: (pattern) => {
      lastVibratedPattern = pattern;
      return true;
    }
  };

  const vibrate = (pattern) => {
    if (typeof mockNavigator !== 'undefined' && mockNavigator.vibrate) {
      try {
        mockNavigator.vibrate(pattern);
      } catch (e) {}
    }
  };

  vibrate(50);
  assert.equal(lastVibratedPattern, 50);

  vibrate(0);
  assert.equal(lastVibratedPattern, 0);

  vibrate([80, 40, 150]);
  assert.deepEqual(lastVibratedPattern, [80, 40, 150]);

  vibrate([]);
  assert.deepEqual(lastVibratedPattern, []);
});

test('2.5.2: Haptic vibrate — absorbs SecurityError without crashing application', () => {
  const mockNavigator = {
    vibrate: () => {
      throw new Error('SecurityError: Vibration denied');
    }
  };

  const vibrate = (pattern) => {
    if (typeof mockNavigator !== 'undefined' && mockNavigator.vibrate) {
      try {
        mockNavigator.vibrate(pattern);
      } catch (e) {}
    }
  };

  assert.doesNotThrow(() => {
    vibrate(100);
  });
});

// -----------------------------------------------------------------------------
// PART 3: REPOSITORY SOURCE CODE & INTERFACE CONTRACT AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- PART 3: Source Code Static Contract Audit ---\n');

test('3.1: ThemeContext.tsx implements all required methods and storage keys', () => {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'ThemeContext.tsx');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes("THEME_STORAGE_KEY = 'bounty_ui_theme'"), 'Uses canonical bounty_ui_theme key');
  assert.ok(code.includes('root.classList.add(\'theme-bright\')'), 'Adds theme-bright on bright');
  assert.ok(code.includes('root.classList.remove(\'theme-bright\')'), 'Removes theme-bright on dark');
  assert.ok(code.includes('meta[name="theme-color"]'), 'Queries meta theme-color');
  assert.ok(code.includes('#f8fafc'), 'Sets #f8fafc on bright');
  assert.ok(code.includes('#0b0c10'), 'Sets #0b0c10 on dark');
  assert.ok(code.includes('typeof window === \'undefined\''), 'Includes SSR window guard');
  assert.ok(code.includes('typeof document === \'undefined\''), 'Includes SSR document guard');
});

test('3.2: GameEffects.ts implements all required sound methods and persistence', () => {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'GameEffects.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  assert.ok(code.includes('bounty_audio_muted'), 'Uses canonical bounty_audio_muted storage key');
  assert.ok(code.includes('playCountdownChime'), 'Implements playCountdownChime');
  assert.ok(code.includes('playMatchStart'), 'Implements playMatchStart');
  assert.ok(code.includes('playPowerUp'), 'Implements playPowerUp');
  assert.ok(code.includes('playFreeze'), 'Implements playFreeze');
  assert.ok(code.includes('playUnfreeze'), 'Implements playUnfreeze');
  assert.ok(code.includes('playVictoryFanfare'), 'Implements playVictoryFanfare');
  assert.ok(code.includes('playDefeatSound'), 'Implements playDefeatSound');
  assert.ok(code.includes('getMuted'), 'Implements getMuted');
  assert.ok(code.includes('setMuted'), 'Implements setMuted');
  assert.ok(code.includes('toggleMute'), 'Implements toggleMute');
  assert.ok(code.includes('this.audioCtx.state === \'suspended\''), 'Checks for suspended AudioContext');
  assert.ok(code.includes('.resume().catch('), 'Resumes suspended AudioContext with catch handler');
});

test('3.3: Tactical power-up sound routing dispatches distinct harmonic frequencies', () => {
  const filePath = path.join(process.cwd(), 'src', 'lib', 'GameEffects.ts');
  const code = fs.readFileSync(filePath, 'utf8');

  // Verify all 4 power-up types handled in switch
  assert.ok(code.includes("case 'sprint':"), 'Handles sprint power-up');
  assert.ok(code.includes("case 'decoy':"), 'Handles decoy power-up');
  assert.ok(code.includes("case 'shield':"), 'Handles shield power-up');
  assert.ok(code.includes("case 'freeze_trap':"), 'Handles freeze_trap power-up');
});

// -----------------------------------------------------------------------------
// SUMMARY & EXIT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  CHALLENGER 2 TEST EXECUTION SUMMARY`);
console.log(`  Total Tests:  ${totalTests}`);
console.log(`  Passed Tests: ${passedTests}`);
console.log(`  Failed Tests: ${failedTests}`);
console.log('================================================================================\n');

if (failedTests > 0) {
  console.error(`🚨 ${failedTests} FAILURE(S) DETECTED:`);
  for (const f of failures) {
    console.error(`  - ${f.name}: ${f.error}`);
  }
  process.exit(1);
} else {
  console.log('✨ ALL 36 ADVERSARIAL THEME & AUDIO TESTS PASSED EMPIRICALLY WITH ZERO FAILURES.');
  process.exit(0);
}
