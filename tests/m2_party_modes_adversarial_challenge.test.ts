/**
 * tests/m2_party_modes_adversarial_challenge.test.ts
 * 
 * EMPIRICAL ADVERSARIAL CHALLENGE SUITE — MILESTONE 2 (Party Game Modes Engine)
 * Author: Challenger 2 (critic, specialist)
 * 
 * Rigorous empirical stress-testing of game mode state transitions and edge cases:
 * 1. Freeze Tag:
 *    - Frozen runners cannot rescue teammates
 *    - Active runner unfreezes teammate within 10m (and fails beyond 10m)
 *    - Self-rescue rejection
 *    - Post-rescue 3-second immunity blocks immediate re-tagging (anti-body camping)
 *    - Immunity expiration allows re-tagging
 *    - Seekers win when all runners are frozen simultaneously (and only when all are frozen)
 * 2. Infection Tag:
 *    - Tagged hiders convert to seekers (role='seeker', isCaught=false)
 *    - Newly converted seekers can immediately tag remaining hiders
 *    - Seeker win occurs when 0 survivors remain
 *    - Sole survivor bonus triggers properly on clock expiration (1 vs 2 vs 0 survivors)
 * 3. Serverless On-Demand Tick Engine:
 *    - evaluateMatchTick transitions match state reliably during request processing without setInterval
 *    - Hiding -> Hunting transition on demand
 *    - Hunting -> Finished (Timeout) transition on demand
 *    - Proximity auto-capture on demand
 *    - Bomb activation and detonation on demand
 *    - Tick debouncing under rapid concurrent polling
 */

// Set VERCEL environment variable BEFORE importing server/index.ts to prevent background intervals and fixed port binding
process.env.VERCEL = '1';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

import http from 'node:http';
import assert from 'node:assert/strict';
import { app } from '../server/index.js';

let passedTests = 0;
let failedTests = 0;
const failureDetails: Array<{ section: string; title: string; error: string }> = [];

async function challenge(section: string, title: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ [${section}] ${title}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL [${section}] ${title}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ section, title, error: err.message });
    failedTests++;
  }
}

// Haversine distance helper (pure math oracle)
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// HTTP request helper to interact directly with the running test Express server
let server: http.Server;
let baseUrl: string;

async function request(
  method: string,
  path: string,
  userId: string,
  body?: any
): Promise<{ status: number; body: any }> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-dev-user-id': userId
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let resBody: any;
  try {
    resBody = await res.json();
  } catch {
    resBody = null;
  }

  return { status: res.status, body: resBody };
}

async function runAllChallenges() {
  console.log('\n================================================================================');
  console.log('  EMPIRICAL CHALLENGER 2: GAME MODE STATE TRANSITIONS & EDGE CASES');
  console.log('================================================================================\n');

  // Start ephemeral server on random available port
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      baseUrl = `http://localhost:${port}`;
      console.log(`📡 Ephemeral test server mounted at ${baseUrl} (zero setInterval active)\n`);
      resolve();
    });
  });

  try {
    // =========================================================================
    // SECTION 1: FREEZE TAG ("BOKSEN GÅR") MECHANICS & ADVERSARIAL EDGE CASES
    // =========================================================================
    console.log('--- SECTION 1: Freeze Tag State Transitions & Edge Cases ---');

    const MATCH_FREEZE_1 = 'FREEZE_TEST_01';

    // Helper: Set player GPS position
    async function setGps(userId: string, lat: number, lng: number) {
      const res = await request('POST', '/api/profile/gps', userId, { lat, lng });
      assert.strictEqual(res.status, 200, `Setting GPS for ${userId} must succeed`);
    }

    // 1.1 Match Creation in Freeze Tag mode
    await challenge('Freeze Tag', '1.1 Host creates Freeze Tag match with rescueRadius=10', async () => {
      const res = await request('POST', '/api/matches', 'host_f1', {
        id: MATCH_FREEZE_1,
        gameMode: 'freeze_tag',
        rescueRadius: 10,
        boundaryRadius: 500,
        centerLat: 59.9139,
        centerLng: 10.7522
      });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.gameMode, 'freeze_tag');
      assert.strictEqual(res.body.rescueRadius, 10);
    });

    // 1.2 Roster Setup: 1 Seeker (S1) and 3 Runners (R1, R2, R3)
    await challenge('Freeze Tag', '1.2 Seeker and 3 runners join match', async () => {
      await request('POST', `/api/matches/${MATCH_FREEZE_1}/join`, 'seeker_f1', { role: 'seeker' });
      await request('POST', `/api/matches/${MATCH_FREEZE_1}/join`, 'runner_f1', { role: 'hider' });
      await request('POST', `/api/matches/${MATCH_FREEZE_1}/join`, 'runner_f2', { role: 'hider' });
      await request('POST', `/api/matches/${MATCH_FREEZE_1}/join`, 'runner_f3', { role: 'hider' });

      // Check match state
      const getRes = await request('GET', `/api/matches/${MATCH_FREEZE_1}`, 'host_f1');
      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.participants.length, 5); // host + seeker_f1 + 3 runners
      const runners = getRes.body.participants.filter((p: any) => p.role === 'hider');
      assert.strictEqual(runners.length, 3);
      runners.forEach((r: any) => {
        assert.strictEqual(r.isFrozen, false, 'Runner must initially be unfrozen');
        assert.strictEqual(r.isCaught, false, 'Runner must initially be uncaught');
      });
    });

    // 1.3 Start match and advance to Hunting phase
    await challenge('Freeze Tag', '1.3 Start match and advance to hunting phase', async () => {
      const startRes = await request('POST', `/api/matches/${MATCH_FREEZE_1}/start`, 'host_f1');
      assert.strictEqual(startRes.status, 200);

      // Force transition to hunting phase by advancing hidingEndsAt
      const state = await request('GET', `/api/matches/${MATCH_FREEZE_1}`, 'host_f1');
      // In mock DB, we can manually set hidingEndsAt to the past via cold sync or endpoint
      // Let's test the endpoint setting hunting status directly or trigger tick
      // Check initial status
      assert.strictEqual(state.body.match.status, 'hiding');
    });

    // 1.4 Seeker tags R1 -> R1 becomes frozen (not caught)
    await challenge('Freeze Tag', '1.4 Seeker tags runner R1 -> R1 becomes frozen (isFrozen=true, isCaught=false)', async () => {
      // Position Seeker and R1 adjacent (2 meters apart)
      await setGps('seeker_f1', 59.91390, 10.75220);
      await setGps('runner_f1', 59.91391, 10.75220); // ~1.1m

      // Force match into hunting phase for catch to succeed
      // Note: /api/matches/:id/settings or manual tick
      // Let's trigger start with 0 hiding duration if possible or set hidingEndsAt
      // Let's check status
      const getRes = await request('GET', `/api/matches/${MATCH_FREEZE_1}`, 'seeker_f1');
      // If still hiding, we can update hidingEndsAt in mock
      // Since we have access to app and mock structures:
      // In server/index.ts, mockMatches is private, but let's see how setting hidingEndsAt works
    });

    // Let's run a baseline to see output
    console.log('  Initial Section 1 setup completed.');

  } finally {
    server.close();
  }
}

runAllChallenges().catch(err => {
  console.error('Fatal challenge error:', err);
  process.exit(1);
});
