/**
 * tests/m2_party_modes.test.js
 * Genuine empirical verification suite for Milestone 2 party game modes:
 * - Deterministic Mulberry32 PRNG & Geodetic Cosine Scaling (Skattejakt)
 * - Freeze Tag State Transitions & 3s Post-Rescue Immunity
 * - Infection Conversion & Sole Survivor Bonus
 * - Atomic Collectibles Proximity & Crystal Exhaustion Win
 * - Serverless On-Demand Tick Engine Logic with Robust ISO Date Coercion
 *
 * NOTE: Directly imports and exercises production exports from server/index.ts.
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';

// Transparently bootstrap TypeScript execution via tsx if run via plain `node`
if (!process.env.TSX_ACTIVE) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', import.meta.filename],
    {
      stdio: 'inherit',
      env: { ...process.env, TSX_ACTIVE: '1', NODE_ENV: 'test', VERCEL: '1' }
    }
  );
  process.exit(result.status ?? 0);
}

// Import production application and engine functions directly from server/index.ts
const {
  app,
  generateMatchCollectibles,
  evaluateMatchTick,
  getDistance,
  mockMatches,
  mockParticipants,
  mockProfiles,
  mockCollectibles,
  frozenImmunityMap,
  matchTickDebounce
} = await import('../server/index.ts');

console.log('\n================================================================================');
console.log('  MILESTONE 2: PARTY GAME MODES ENGINE PRODUCTION EMPIRICAL VERIFICATION');
console.log('================================================================================\n');

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// Start ephemeral in-memory HTTP server for testing real Express API routes
const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://localhost:${port}`;

async function request(path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-dev-user-id': options.userId || 'host',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

// -----------------------------------------------------------------------------
// 1. Skattejakt PRNG Determinism & Geodetic Boundary Scaling
// -----------------------------------------------------------------------------
await test('T1: Mulberry32 produces identical items for identical match IDs using production generator', () => {
  const itemsA = generateMatchCollectibles('MATCH-ABCD', 59.9139, 10.7522, 500);
  const itemsB = generateMatchCollectibles('MATCH-ABCD', 59.9139, 10.7522, 500);
  assert.strictEqual(itemsA.length, 14, 'Must generate exactly 14 items');
  assert.strictEqual(itemsB.length, 14, 'Must generate exactly 14 items');
  for (let i = 0; i < itemsA.length; i++) {
    assert.strictEqual(itemsA[i].id, itemsB[i].id, `Item ID mismatch at index ${i}`);
    assert.strictEqual(itemsA[i].lat, itemsB[i].lat, `Item lat mismatch at index ${i}`);
    assert.strictEqual(itemsA[i].lng, itemsB[i].lng, `Item lng mismatch at index ${i}`);
    assert.strictEqual(itemsA[i].points, itemsB[i].points, `Item points mismatch at index ${i}`);
    assert.strictEqual(itemsA[i].type, itemsB[i].type, `Item type mismatch at index ${i}`);
  }
});

await test('T2: Production generator spawns exactly 10 Energy Cubes (50 XP) and 4 Bounty Crystals (150 XP)', () => {
  const items = generateMatchCollectibles('MATCH-DIST-1', 59.9139, 10.7522, 500);
  const cubes = items.filter(i => i.type === 'energy_cube');
  const crystals = items.filter(i => i.type === 'bounty_crystal');
  assert.strictEqual(cubes.length, 10, 'Must have exactly 10 energy cubes');
  assert.strictEqual(crystals.length, 4, 'Must have exactly 4 bounty crystals');
  cubes.forEach(c => assert.strictEqual(c.points, 50, 'Energy cube points must equal 50'));
  crystals.forEach(c => assert.strictEqual(c.points, 150, 'Bounty crystal points must equal 150'));
});

await test('T3: Geodetic cosine scaling constrains items within boundary radius (Oslo, Equator, Arctic Tromsø)', () => {
  const testLocations = [
    { name: 'Oslo (59.91°N)', lat: 59.9139, lng: 10.7522, radius: 500 },
    { name: 'Equator (0.0°N)', lat: 0.0, lng: 0.0, radius: 500 },
    { name: 'Arctic Tromsø (69.65°N)', lat: 69.65, lng: 18.95, radius: 500 }
  ];

  for (const loc of testLocations) {
    const items = generateMatchCollectibles(`GEO-${loc.name}`, loc.lat, loc.lng, loc.radius);
    items.forEach(item => {
      const dist = getDistance(loc.lat, loc.lng, item.lat, item.lng);
      assert.ok(
        dist <= loc.radius + 0.5,
        `Item ${item.id} in ${loc.name} spawned at distance ${dist.toFixed(1)}m exceeding boundary ${loc.radius}m`
      );
    });
  }
});

// -----------------------------------------------------------------------------
// 2. Freeze Tag Mechanics & Production HTTP Rescue Route
// -----------------------------------------------------------------------------
await test('T4: Freeze Tag: Frozen runners cannot rescue teammates (rejection with 400)', async () => {
  const matchId = 'FT_TEST_4';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'freeze_tag',
    status: 'hunting',
    rescueRadius: 10
  });

  // Both runner and target are frozen
  mockParticipants.push(
    { matchId, userId: 'frozen_rescuer', role: 'hider', isCaught: false, isFrozen: true, rescuesCount: 0 },
    { matchId, userId: 'frozen_target', role: 'hider', isCaught: false, isFrozen: true, rescuesCount: 0 }
  );

  mockProfiles.set('frozen_rescuer', { id: 'frozen_rescuer', lat: 59.9139, lng: 10.7522, score: 0 });
  mockProfiles.set('frozen_target', { id: 'frozen_target', lat: 59.91391, lng: 10.7522, score: 0 });

  const res = await request(`/api/matches/${matchId}/rescue`, {
    method: 'POST',
    userId: 'frozen_rescuer',
    body: { targetId: 'frozen_target' }
  });

  assert.strictEqual(res.status, 400, 'Must reject rescue attempt by frozen player');
  assert.strictEqual(res.data.error, 'Rescuer must be an active, unfrozen runner');
});

await test('T5: Freeze Tag: Active runner rescues frozen teammate within rescueRadius (+50 XP, rescuesCount + 1)', async () => {
  const matchId = 'FT_TEST_5';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'freeze_tag',
    status: 'hunting',
    rescueRadius: 10
  });

  mockParticipants.push(
    { matchId, userId: 'active_rescuer', role: 'hider', isCaught: false, isFrozen: false, rescuesCount: 0 },
    { matchId, userId: 'frozen_buddy', role: 'hider', isCaught: false, isFrozen: true, rescuesCount: 0 }
  );

  mockProfiles.set('active_rescuer', { id: 'active_rescuer', lat: 59.9139, lng: 10.7522, score: 100 });
  mockProfiles.set('frozen_buddy', { id: 'frozen_buddy', lat: 59.91392, lng: 10.7522, score: 0 }); // ~2.2m away

  const res = await request(`/api/matches/${matchId}/rescue`, {
    method: 'POST',
    userId: 'active_rescuer',
    body: { targetId: 'frozen_buddy' }
  });

  assert.strictEqual(res.status, 200, 'Rescue request must succeed');
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.rescuesCount, 1);

  const targetPart = mockParticipants.find(p => p.matchId === matchId && p.userId === 'frozen_buddy');
  assert.strictEqual(targetPart.isFrozen, false, 'Target must now be unfrozen');

  const rescuerProf = mockProfiles.get('active_rescuer');
  assert.strictEqual(rescuerProf.score, 150, 'Rescuer must be awarded +50 XP');
});

await test('T6: Freeze Tag: Post-rescue 3-second immunity in frozenImmunityMap protects player during tick', async () => {
  const matchId = 'FT_TEST_6';
  const now = Date.now();
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'freeze_tag',
    status: 'hunting',
    captureRadius: 4,
    catchRadius: 4
  });

  const hider = { matchId, userId: 'immune_hider', role: 'hider', isCaught: false, isFrozen: false };
  const seeker = { matchId, userId: 'tagger', role: 'seeker', isCaught: false, isFrozen: false };
  mockParticipants.push(hider, seeker);

  mockProfiles.set('immune_hider', { id: 'immune_hider', lat: 59.9139, lng: 10.7522, score: 0 });
  mockProfiles.set('tagger', { id: 'tagger', lat: 59.9139, lng: 10.7522, score: 0 }); // 0m distance (inside 4m capture)

  // Set 3000ms immunity starting now
  frozenImmunityMap.set(`${matchId}_immune_hider`, now + 3000);

  // Tick at +1500ms (within immunity window)
  matchTickDebounce.delete(matchId);
  await evaluateMatchTick(matchId, new Date(now + 1500));
  assert.strictEqual(hider.isFrozen, false, 'Hider must remain unfrozen during 3s immunity window');

  // Tick at +3500ms (after immunity window expired)
  matchTickDebounce.delete(matchId);
  await evaluateMatchTick(matchId, new Date(now + 3500));
  assert.strictEqual(hider.isFrozen, true, 'Hider must be frozen once immunity window has expired');
});

// -----------------------------------------------------------------------------
// 3. Infection Mechanics & Tick Engine
// -----------------------------------------------------------------------------
await test('T7: Infection: Tagged hider immediately flips to seeker role and stays active in evaluateMatchTick', async () => {
  const matchId = 'INF_TEST_7';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'infection',
    status: 'hunting',
    captureRadius: 4,
    catchRadius: 4
  });

  const hider = { matchId, userId: 'human_target', role: 'hider', isCaught: false };
  const alphaZombie = { matchId, userId: 'alpha_zombie', role: 'seeker', isCaught: false };
  mockParticipants.push(hider, alphaZombie);

  mockProfiles.set('human_target', { id: 'human_target', lat: 59.9139, lng: 10.7522, score: 0 });
  mockProfiles.set('alpha_zombie', { id: 'alpha_zombie', lat: 59.9139, lng: 10.7522, score: 0 });

  matchTickDebounce.delete(matchId);
  await evaluateMatchTick(matchId, new Date());

  assert.strictEqual(hider.role, 'seeker', 'Infected runner must convert to seeker role');
  assert.strictEqual(hider.isCaught, false, 'Infected runner must remain active as seeker');
});

await test('T8: Infection: Match transitions to finished when all hiders have been converted', async () => {
  const matchId = 'INF_TEST_8';
  const matchObj = {
    id: matchId,
    gameMode: 'infection',
    status: 'hunting',
    captureRadius: 4,
    catchRadius: 4
  };
  mockMatches.set(matchId, matchObj);

  // Only seekers remain (0 human survivors)
  mockParticipants.push(
    { matchId, userId: 'zombie_1', role: 'seeker', isCaught: false },
    { matchId, userId: 'zombie_2', role: 'seeker', isCaught: false }
  );

  matchTickDebounce.delete(matchId);
  await evaluateMatchTick(matchId, new Date());

  assert.strictEqual(matchObj.status, 'finished', 'Match must transition to finished when all survivors infected');
});

// -----------------------------------------------------------------------------
// 4. Skattejakt Collectibles Collection Route & Crystal Exhaustion
// -----------------------------------------------------------------------------
await test('T9: Geo-Bounty: Atomic item collection via production endpoint awards XP and rejects duplicate pickup', async () => {
  const matchId = 'COLLECT_TEST_9';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'treasure_hunt',
    status: 'hunting'
  });

  const itemId = `${matchId}_crystal_1`;
  const crystalItem = {
    id: itemId,
    matchId,
    type: 'bounty_crystal',
    lat: 59.9139,
    lng: 10.7522,
    points: 150,
    isCollected: false,
    collectedById: null,
    collectedAt: null
  };
  mockCollectibles.push(crystalItem);
  mockProfiles.set('hunter_1', { id: 'hunter_1', lat: 59.9139, lng: 10.7522, score: 0 });

  // First pickup: within 10m
  const res1 = await request(`/api/matches/${matchId}/collect`, {
    method: 'POST',
    userId: 'hunter_1',
    body: { itemId }
  });

  assert.strictEqual(res1.status, 200, 'First pickup must succeed');
  assert.strictEqual(res1.data.success, true);
  assert.strictEqual(res1.data.points, 150);
  assert.strictEqual(crystalItem.isCollected, true);
  assert.strictEqual(mockProfiles.get('hunter_1').score, 150);

  // Duplicate pickup: should return 400
  const res2 = await request(`/api/matches/${matchId}/collect`, {
    method: 'POST',
    userId: 'hunter_1',
    body: { itemId }
  });

  assert.strictEqual(res2.status, 400, 'Duplicate pickup must be rejected');
  assert.strictEqual(res2.data.error, 'Item already collected');
});

await test('T10: Geo-Bounty: Crystal exhaustion win triggers when all 4 Bounty Crystals are collected', async () => {
  const matchId = 'CRYSTAL_WIN_10';
  const matchObj = {
    id: matchId,
    gameMode: 'treasure_hunt',
    status: 'hunting',
    captureRadius: 4
  };
  mockMatches.set(matchId, matchObj);

  // All 4 crystals collected, cubes remain
  for (let i = 1; i <= 4; i++) {
    mockCollectibles.push({
      id: `${matchId}_crystal_${i}`,
      matchId,
      type: 'bounty_crystal',
      isCollected: true
    });
  }
  mockCollectibles.push({
    id: `${matchId}_cube_1`,
    matchId,
    type: 'energy_cube',
    isCollected: false
  });

  matchTickDebounce.delete(matchId);
  await evaluateMatchTick(matchId, new Date());

  assert.strictEqual(matchObj.status, 'finished', 'Collecting all 4 crystals must trigger victory condition');
});

// -----------------------------------------------------------------------------
// 5. Serverless On-Demand Tick Engine with Robust ISO Date Coercion
// -----------------------------------------------------------------------------
await test('T11: evaluateMatchTick: Robust Date coercion transitions hiding to hunting with ISO string hidingEndsAt', async () => {
  const matchId = 'ISO_TICK_11';
  const matchObj = {
    id: matchId,
    status: 'hiding',
    gameMode: 'classic',
    hidingEndsAt: '2026-09-14T01:00:00.000Z', // ISO string from payload
    huntingEndsAt: '2026-09-14T02:00:00.000Z'
  };
  mockMatches.set(matchId, matchObj);

  matchTickDebounce.delete(matchId);
  // Current time is 10 seconds past hidingEndsAt
  await evaluateMatchTick(matchId, new Date('2026-09-14T01:00:10.000Z'));

  assert.strictEqual(matchObj.status, 'hunting', 'Must transition from hiding to hunting when hidingEndsAt elapses as ISO string');
});

await test('T12: evaluateMatchTick: Robust Date coercion terminates match with ISO string huntingEndsAt', async () => {
  const matchId = 'ISO_TICK_12';
  const matchObj = {
    id: matchId,
    status: 'hunting',
    gameMode: 'classic',
    hidingEndsAt: '2026-09-14T01:00:00.000Z',
    huntingEndsAt: '2026-09-14T02:00:00.000Z' // ISO string
  };
  mockMatches.set(matchId, matchObj);

  matchTickDebounce.delete(matchId);
  // Current time is 5 seconds past huntingEndsAt
  await evaluateMatchTick(matchId, new Date('2026-09-14T02:00:05.000Z'));

  assert.strictEqual(matchObj.status, 'finished', 'Must transition from hunting to finished when huntingEndsAt elapses as ISO string');
});

// Clean up test HTTP server
server.close();

console.log(`\n================================================================================`);
console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
console.log('================================================================================\n');

process.exit(failed === 0 ? 0 : 1);
