/**
 * tests/stress_m3_challenger.js
 * Adversarial test harness for Milestone 3:
 * 1. GPS accuracy updates & fallback behavior (null vs numeric, simulated vs live).
 * 2. Next reveal countdown timer calculation and match clock formatting under edge cases.
 * 3. Active vs caught hider status transitions and role badge color rendering.
 */

import { assert } from './harness.js';
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

console.log('================================================================================');
console.log('  EMPIRICAL CHALLENGER: MILESTONE 3 TELEMETRY ADVERSARIAL SUITE');
console.log('================================================================================\n');

// -----------------------------------------------------------------------------
// SECTION 1: GPS Accuracy Updates & Fallbacks
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: GPS Accuracy Updates & Fallback Behavior ---');

function formatGpsAccuracy(accuracy, isSimulated) {
  const isSimOrNull = isSimulated || accuracy == null;
  return {
    dotClass: isSimOrNull ? 'bg-cyber-yellow' : 'bg-cyber-green shadow-green-glow animate-pulse',
    textClass: isSimOrNull ? 'text-cyber-yellow' : 'text-cyber-green',
    label: isSimOrNull ? 'GPS: SIMULATED' : `±${Math.round(accuracy)}m`
  };
}

testCase('1.1: Accuracy null with isSimulated false (GPS waiting for initial fix)', () => {
  const res = formatGpsAccuracy(null, false);
  assert.equal(res.label, 'GPS: SIMULATED');
  assert.equal(res.dotClass, 'bg-cyber-yellow');
  assert.equal(res.textClass, 'text-cyber-yellow');
});

testCase('1.2: Accuracy null with isSimulated true (Explicit simulation mode)', () => {
  const res = formatGpsAccuracy(null, true);
  assert.equal(res.label, 'GPS: SIMULATED');
  assert.equal(res.dotClass, 'bg-cyber-yellow');
  assert.equal(res.textClass, 'text-cyber-yellow');
});

testCase('1.3: High-accuracy real GPS fix (accuracy = 3.2m, isSimulated = false)', () => {
  const res = formatGpsAccuracy(3.2, false);
  assert.equal(res.label, '±3m');
  assert.ok(res.dotClass.includes('bg-cyber-green'));
  assert.ok(res.dotClass.includes('animate-pulse'));
  assert.equal(res.textClass, 'text-cyber-green');
});

testCase('1.4: Sub-meter RTK GPS accuracy (accuracy = 0.4m, isSimulated = false)', () => {
  const res = formatGpsAccuracy(0.4, false);
  assert.equal(res.label, '±0m');
  assert.ok(res.dotClass.includes('bg-cyber-green'));
});

testCase('1.5: Exact zero accuracy edge case (accuracy = 0, isSimulated = false)', () => {
  // 0 == null is false in JS
  const res = formatGpsAccuracy(0, false);
  assert.equal(res.label, '±0m');
  assert.ok(res.dotClass.includes('bg-cyber-green'));
  assert.equal(res.textClass, 'text-cyber-green');
});

testCase('1.6: Coarse GPS accuracy with rounding (accuracy = 1250.7m, isSimulated = false)', () => {
  const res = formatGpsAccuracy(1250.7, false);
  assert.equal(res.label, '±1251m');
  assert.ok(res.dotClass.includes('bg-cyber-green'));
});

testCase('1.7: Undefined accuracy (missing property)', () => {
  const res = formatGpsAccuracy(undefined, false);
  assert.equal(res.label, 'GPS: SIMULATED');
  assert.equal(res.dotClass, 'bg-cyber-yellow');
});

testCase('1.8: Accuracy present but isSimulated is true (Simulator overrides numeric accuracy)', () => {
  const res = formatGpsAccuracy(5.0, true);
  assert.equal(res.label, 'GPS: SIMULATED');
  assert.equal(res.dotClass, 'bg-cyber-yellow');
});

testCase('1.9: Dynamic sequence of accuracy transitions', () => {
  const sequence = [
    { acc: null, sim: true, expected: 'GPS: SIMULATED' },
    { acc: 15.2, sim: false, expected: '±15m' },
    { acc: 4.8, sim: false, expected: '±5m' },
    { acc: null, sim: false, expected: 'GPS: SIMULATED' },
    { acc: 2.1, sim: false, expected: '±2m' },
    { acc: null, sim: true, expected: 'GPS: SIMULATED' },
  ];

  sequence.forEach(({ acc, sim, expected }, i) => {
    const res = formatGpsAccuracy(acc, sim);
    assert.equal(res.label, expected, `Step ${i} failed`);
  });
});

testCase('1.10: GpsContext.tsx contract audit', () => {
  const contextContent = fs.readFileSync('src/lib/GpsContext.tsx', 'utf8');
  assert.ok(contextContent.includes('accuracy: number | null;'), 'GpsContextType must declare accuracy');
  assert.ok(contextContent.includes('setAccuracy(null)'), 'Must reset accuracy to null in simulation');
  assert.ok(contextContent.includes('setAccuracy(reportedAccuracy ?? 5)'), 'Must update accuracy from coords');
});

// -----------------------------------------------------------------------------
// SECTION 2: Next Reveal Countdown & Match Clock Formatting
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Next Reveal Countdown & Match Clock Edge Cases ---');

function computeTimers(match, now) {
  if (!match || match.status === 'waiting' || match.status === 'finished') {
    return { phase: '', timeStr: '', secondsLeft: 0 };
  }

  const hidingEnds = new Date(match.hidingEndsAt).getTime();
  const huntingEnds = new Date(match.huntingEndsAt).getTime();

  if (now < hidingEnds) {
    const left = Math.max(0, Math.floor((hidingEnds - now) / 1000));
    const mins = Math.floor(left / 60);
    const secs = left % 60;
    return { 
      phase: 'HIDING PHASE', 
      timeStr: `${mins}:${secs.toString().padStart(2, '0')}`,
      secondsLeft: left
    };
  } else {
    const left = Math.max(0, Math.floor((huntingEnds - now) / 1000));
    const mins = Math.floor(left / 60);
    const secs = left % 60;

    // Calculate reveal interval countdown
    const huntingElapsed = now - hidingEnds;
    const intervalMs = (match.revealInterval ?? 120) * 1000;
    const revealSecondsLeft = Math.max(0, Math.floor((intervalMs - (huntingElapsed % intervalMs)) / 1000));
    const rMins = Math.floor(revealSecondsLeft / 60);
    const rSecs = revealSecondsLeft % 60;

    return {
      phase: 'HUNTING PHASE',
      timeStr: `${mins}:${secs.toString().padStart(2, '0')}`,
      secondsLeft: left,
      revealTimeStr: `${rMins}:${rSecs.toString().padStart(2, '0')}`,
      revealSecondsLeft
    };
  }
}

const baseMatch = {
  status: 'hunting',
  hidingEndsAt: new Date(1000000).toISOString(),
  huntingEndsAt: new Date(1900000).toISOString(), // 900s match
  revealInterval: 120
};

testCase('2.1: Match clock at exactly 0 seconds remaining (now === huntingEndsAt)', () => {
  const t = computeTimers(baseMatch, 1900000);
  assert.equal(t.timeStr, '0:00');
  assert.equal(t.secondsLeft, 0);
});

testCase('2.2: Match clock after timeout (now > huntingEndsAt by 35 seconds)', () => {
  const t = computeTimers(baseMatch, 1935000);
  assert.equal(t.timeStr, '0:00');
  assert.equal(t.secondsLeft, 0);
});

testCase('2.3: Match clock 1 second before timeout', () => {
  const t = computeTimers(baseMatch, 1899000);
  assert.equal(t.timeStr, '0:01');
  assert.equal(t.secondsLeft, 1);
});

testCase('2.4: Reveal countdown at start of hunting phase (huntingElapsed === 0)', () => {
  const t = computeTimers(baseMatch, 1000000);
  assert.equal(t.revealTimeStr, '2:00');
  assert.equal(t.revealSecondsLeft, 120);
});

testCase('2.5: Reveal countdown 1 second before reveal snapshot (huntingElapsed === 119s)', () => {
  const t = computeTimers(baseMatch, 1000000 + 119000);
  assert.equal(t.revealTimeStr, '0:01');
  assert.equal(t.revealSecondsLeft, 1);
});

testCase('2.6: Reveal countdown at sub-second boundary (huntingElapsed === 119.999s)', () => {
  const t = computeTimers(baseMatch, 1000000 + 119999);
  assert.equal(t.revealTimeStr, '0:00');
  assert.equal(t.revealSecondsLeft, 0);
});

testCase('2.7: Reveal countdown at exact reveal cycle rollover (huntingElapsed === 120.000s)', () => {
  const t = computeTimers(baseMatch, 1000000 + 120000);
  // Rollover back to full interval
  assert.equal(t.revealTimeStr, '2:00');
  assert.equal(t.revealSecondsLeft, 120);
});

testCase('2.8: Reveal countdown monotonicity across 3 full reveal cycles (360 seconds)', () => {
  let prevSeconds = 120;
  for (let sec = 1; sec <= 360; sec++) {
    const t = computeTimers(baseMatch, 1000000 + (sec * 1000));
    if (sec % 120 === 0) {
      assert.equal(t.revealSecondsLeft, 120, `Rollover at sec ${sec} must reset to 120`);
      prevSeconds = 120;
    } else {
      assert.equal(t.revealSecondsLeft, prevSeconds - 1, `Second ${sec} must decrement by 1`);
      prevSeconds = t.revealSecondsLeft;
    }
  }
});

testCase('2.9: Custom revealInterval (e.g. 45 seconds)', () => {
  const customMatch = { ...baseMatch, revealInterval: 45 };
  const t0 = computeTimers(customMatch, 1000000);
  assert.equal(t0.revealTimeStr, '0:45');
  const t44 = computeTimers(customMatch, 1000000 + 44000);
  assert.equal(t44.revealTimeStr, '0:01');
});

testCase('2.10: Hiding phase timer edge cases (now < hidingEndsAt)', () => {
  const tHiding = computeTimers(baseMatch, 950000);
  assert.equal(tHiding.phase, 'HIDING PHASE');
  assert.equal(tHiding.timeStr, '0:50');
  assert.equal(tHiding.secondsLeft, 50);
  assert.equal(tHiding.revealTimeStr, undefined, 'Hiding phase must not expose reveal countdown');
});

// -----------------------------------------------------------------------------
// SECTION 3: Active vs Caught Hider Transitions & Role Badge Rendering
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Active vs Caught Hider Transitions & Role Badges ---');

function evaluateTopRoleBadge(participant) {
  const isCaught = participant?.isCaught;
  const role = participant?.role;
  const badgeClasses = isCaught
    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700 line-through'
    : role === 'seeker'
      ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30'
      : 'bg-cyber-green/10 text-cyber-green border-cyber-green/30';
  const label = `${role} ${isCaught ? '(CAPTURED)' : '(ACTIVE)'}`;
  return { badgeClasses, label, isCaught, role };
}

function evaluateRosterParticipant(p) {
  const dotClasses = p.role === 'seeker'
    ? 'bg-cyber-cyan shadow-cyan-glow/20'
    : p.isCaught
    ? 'bg-zinc-600'
    : 'bg-cyber-green shadow-green-glow/20';

  const textClasses = p.isCaught ? 'text-zinc-500' : p.role === 'seeker' ? 'text-cyber-cyan' : 'text-cyber-green';
  const statusLabel = p.role === 'seeker' ? 'Seeker' : p.isCaught ? 'Caught' : 'Active';

  return { dotClasses, textClasses, statusLabel };
}

function evaluateActionDockHiderStatus(participant) {
  if (participant?.role !== 'hider') return null;
  return {
    isCaught: participant.isCaught,
    label: participant.isCaught ? 'CAPTURED & DESYNCED' : 'EVADING RADAR',
    classes: participant.isCaught
      ? 'text-zinc-500 font-black text-[10px] md:text-xs uppercase'
      : 'text-cyber-green font-black text-[10px] md:text-xs glow-green uppercase animate-pulse'
  };
}

testCase('3.1: Active Hider top badge renders vibrant green and (ACTIVE)', () => {
  const badge = evaluateTopRoleBadge({ role: 'hider', isCaught: false });
  assert.equal(badge.label, 'hider (ACTIVE)');
  assert.ok(badge.badgeClasses.includes('text-cyber-green'));
  assert.ok(badge.badgeClasses.includes('bg-cyber-green/10'));
  assert.ok(!badge.badgeClasses.includes('line-through'));
});

testCase('3.2: Caught Hider top badge transitions to muted zinc with line-through and (CAPTURED)', () => {
  const badge = evaluateTopRoleBadge({ role: 'hider', isCaught: true });
  assert.equal(badge.label, 'hider (CAPTURED)');
  assert.ok(badge.badgeClasses.includes('text-zinc-400'));
  assert.ok(badge.badgeClasses.includes('bg-zinc-800/80'));
  assert.ok(badge.badgeClasses.includes('line-through'));
  assert.ok(!badge.badgeClasses.includes('text-cyber-green'));
});

testCase('3.3: Active Seeker top badge renders cyber-cyan', () => {
  const badge = evaluateTopRoleBadge({ role: 'seeker', isCaught: false });
  assert.equal(badge.label, 'seeker (ACTIVE)');
  assert.ok(badge.badgeClasses.includes('text-cyber-cyan'));
  assert.ok(!badge.badgeClasses.includes('line-through'));
});

testCase('3.4: Roster indicator for active hider renders cyber-green dot and Active text', () => {
  const roster = evaluateRosterParticipant({ id: 'p1', name: 'Ghost', role: 'hider', isCaught: false });
  assert.equal(roster.statusLabel, 'Active');
  assert.ok(roster.dotClasses.includes('bg-cyber-green'));
  assert.ok(roster.textClasses.includes('text-cyber-green'));
});

testCase('3.5: Roster indicator for caught hider renders muted zinc-600 dot and Caught text', () => {
  const roster = evaluateRosterParticipant({ id: 'p1', name: 'Ghost', role: 'hider', isCaught: true });
  assert.equal(roster.statusLabel, 'Caught');
  assert.ok(roster.dotClasses.includes('bg-zinc-600'));
  assert.ok(roster.textClasses.includes('text-zinc-500'));
  assert.ok(!roster.dotClasses.includes('bg-cyber-green'));
});

testCase('3.6: Roster indicator for seeker renders cyber-cyan dot and Seeker text', () => {
  const roster = evaluateRosterParticipant({ id: 'p2', name: 'Hunter', role: 'seeker', isCaught: false });
  assert.equal(roster.statusLabel, 'Seeker');
  assert.ok(roster.dotClasses.includes('bg-cyber-cyan'));
  assert.ok(roster.textClasses.includes('text-cyber-cyan'));
});

testCase('3.7: Action dock hider panel transitions from EVADING RADAR to CAPTURED & DESYNCED', () => {
  const activeStatus = evaluateActionDockHiderStatus({ role: 'hider', isCaught: false });
  assert.equal(activeStatus.label, 'EVADING RADAR');
  assert.ok(activeStatus.classes.includes('text-cyber-green'));
  assert.ok(activeStatus.classes.includes('glow-green'));
  assert.ok(activeStatus.classes.includes('animate-pulse'));

  const caughtStatus = evaluateActionDockHiderStatus({ role: 'hider', isCaught: true });
  assert.equal(caughtStatus.label, 'CAPTURED & DESYNCED');
  assert.ok(caughtStatus.classes.includes('text-zinc-500'));
  assert.ok(!caughtStatus.classes.includes('animate-pulse'));
});

testCase('3.8: Complete match catch event transition cycle', () => {
  // Simulate match where hider is initially active, then gets caught
  let participant = { id: 'hider1', name: 'Shadow', role: 'hider', isCaught: false };

  // Phase 1: Active
  let topBadge = evaluateTopRoleBadge(participant);
  let roster = evaluateRosterParticipant(participant);
  let actionDock = evaluateActionDockHiderStatus(participant);

  assert.equal(topBadge.label, 'hider (ACTIVE)');
  assert.equal(roster.statusLabel, 'Active');
  assert.equal(actionDock.label, 'EVADING RADAR');

  // Phase 2: Caught trigger (server auto-capture or bomb detonation)
  participant = { ...participant, isCaught: true };

  topBadge = evaluateTopRoleBadge(participant);
  roster = evaluateRosterParticipant(participant);
  actionDock = evaluateActionDockHiderStatus(participant);

  assert.equal(topBadge.label, 'hider (CAPTURED)');
  assert.ok(topBadge.badgeClasses.includes('line-through'));
  assert.equal(roster.statusLabel, 'Caught');
  assert.equal(actionDock.label, 'CAPTURED & DESYNCED');
});

testCase('3.9: Matches.tsx codebase token audit (Zero amber-500 occurrences)', () => {
  const matchesContent = fs.readFileSync('src/pages/Matches.tsx', 'utf8');
  assert.ok(!matchesContent.includes('amber-500'), 'Matches.tsx must contain 0 amber-500 references');
});

testCase('3.10: glow-green neon text shadow utility declared in src/index.css', () => {
  const cssContent = fs.readFileSync('src/index.css', 'utf8');
  assert.ok(cssContent.includes('.glow-green'), 'index.css must declare .glow-green');
  assert.ok(cssContent.includes('rgba(57, 255, 20'), 'glow-green must match #39ff14 rgb values');
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
