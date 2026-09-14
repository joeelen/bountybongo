/**
 * tests/m2_spatial_collectibles_challenge.test.js
 * Adversarial Empirical Challenge Suite for Milestone 2:
 * 1. Mulberry32 PRNG determinism & statistical distribution across diverse seeds.
 * 2. Geodetic latitude cosine scaling: strict containment within boundaryRadius across latitudes
 *    (Equator 0°, London 51.5°, Oslo 59.9°, Tromsø 69.6° with 500+ seeds each, 28,000 items).
 * 3. Great-circle proximity collection: exact 10.0m boundary edge cases (pickup at 9.99m vs rejection at 10.01m)
 *    executed against the live Express HTTP endpoint (/api/matches/:id/collect).
 * 4. Concurrency & double collection: atomic collection flag preventing duplicate XP attribution
 *    under concurrent HTTP load (2 simultaneous requests, 50 competing clients, and rapid replay).
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

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
  getDistance,
  hashSeed,
  mulberry32,
  mockMatches,
  mockProfiles,
  mockCollectibles
} = await import('../server/index.ts');

console.log('\n================================================================================');
console.log('  MILESTONE 2: ADVERSARIAL SPATIAL & COLLECTIBLE MATH EMPIRICAL CHALLENGE');
console.log('================================================================================\n');

let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function challenge(title, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ title, error: err.message, stack: err.stack });
    failedTests++;
  }
}

async function asyncChallenge(title, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${title}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${title}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ title, error: err.message, stack: err.stack });
    failedTests++;
  }
}

// Start ephemeral in-memory HTTP server for testing real Express API routes
const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://localhost:${port}`;

// Geodesic destination point calculation on sphere of radius R = 6,371,000m
function destinationPoint(lat0, lng0, distanceMeters, bearingDegrees) {
  const R = 6371000;
  const delta = distanceMeters / R;
  const theta = (bearingDegrees * Math.PI) / 180;
  const phi1 = (lat0 * Math.PI) / 180;
  const lambda1 = (lng0 * Math.PI) / 180;

  const sinPhi2 =
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);
  const y = Math.sin(theta) * Math.sin(delta) * Math.cos(phi1);
  const x = Math.cos(delta) - Math.sin(phi1) * sinPhi2;
  const lambda2 = lambda1 + Math.atan2(y, x);

  return {
    lat: (phi2 * 180) / Math.PI,
    lng: (lambda2 * 180) / Math.PI
  };
}

// -----------------------------------------------------------------------------
// SECTION 1: MULBERRY32 PRNG DETERMINISM & STATISTICAL DISTRIBUTION
// -----------------------------------------------------------------------------
console.log('[SECTION 1] Mulberry32 PRNG Determinism & Distribution:');

challenge('Mulberry32 produces bit-for-bit identical sequences for identical seeds across 500 iterations', () => {
  const testSeeds = [
    'MATCH_ALPHA',
    'MATCH_OMEGA',
    'uuid-1234-5678-90ab-cdef',
    'oslo_match_2026_09_13',
    '', // empty string edge case
    '0',
    '⚡Cyberpunk-Match-🚀',
    'a'.repeat(256), // long string edge case
    'Special_!@#$%^&*()_+-='
  ];

  for (const seedStr of testSeeds) {
    const numericSeed = hashSeed(seedStr) || 54321;
    const rng1 = mulberry32(numericSeed);
    const rng2 = mulberry32(numericSeed);

    for (let i = 0; i < 500; i++) {
      const v1 = rng1();
      const v2 = rng2();
      assert.strictEqual(
        v1,
        v2,
        `Mulberry32 desync for seed "${seedStr}" at step ${i}: ${v1} !== ${v2}`
      );
    }
  }
});

challenge('Mulberry32 produces divergent sequences for different seeds (no seed collision or trivial correlation)', () => {
  const pairs = [
    ['MATCH_001', 'MATCH_002'],
    ['GAME_A', 'GAME_B'],
    ['1', '2'],
    ['MATCH_AAAA', 'MATCH_AAAB']
  ];

  for (const [s1, s2] of pairs) {
    const rng1 = mulberry32(hashSeed(s1) || 54321);
    const rng2 = mulberry32(hashSeed(s2) || 54321);

    const seq1 = Array.from({ length: 20 }, () => rng1());
    const seq2 = Array.from({ length: 20 }, () => rng2());

    assert.notDeepStrictEqual(
      seq1,
      seq2,
      `Collision between different seeds "${s1}" and "${s2}"`
    );
    assert.notStrictEqual(
      seq1[0],
      seq2[0],
      `First output identical between "${s1}" and "${s2}"`
    );
  }
});

challenge('Mulberry32 outputs are strictly bounded in [0, 1) across 200,000 samples', () => {
  const sampleCount = 200000;
  const rng = mulberry32(0xdeadbeef);

  let min = 1.0;
  let max = 0.0;

  for (let i = 0; i < sampleCount; i++) {
    const val = rng();
    if (val < min) min = val;
    if (val > max) max = val;

    assert.ok(
      val >= 0.0 && val < 1.0,
      `PRNG generated out-of-bounds value: ${val} (step ${i})`
    );
  }

  assert.ok(min >= 0.0, `Min ${min} is negative`);
  assert.ok(max < 1.0, `Max ${max} reached or exceeded 1.0`);
  assert.ok(min < 0.001, `Min ${min} is unexpectedly large`);
  assert.ok(max > 0.999, `Max ${max} is unexpectedly small`);
});

challenge('Mulberry32 statistical distribution satisfies Uniform [0, 1) properties (mean, variance, Chi-Square)', () => {
  const numSeeds = 1000;
  const samplesPerSeed = 100;
  const totalSamples = numSeeds * samplesPerSeed;
  const numBins = 10;
  const bins = new Array(numBins).fill(0);

  let sum = 0;
  let sumSq = 0;

  for (let s = 0; s < numSeeds; s++) {
    const seed = hashSeed(`seed_distribution_test_${s}`) || 54321;
    const rng = mulberry32(seed);

    for (let i = 0; i < samplesPerSeed; i++) {
      const val = rng();
      sum += val;
      sumSq += val * val;

      const binIndex = Math.min(Math.floor(val * numBins), numBins - 1);
      bins[binIndex]++;
    }
  }

  const mean = sum / totalSamples;
  const variance = sumSq / totalSamples - mean * mean;
  const expectedMean = 0.5;
  const expectedVariance = 1 / 12;

  console.log(
    `    [PRNG Stats]: Sample Mean = ${mean.toFixed(5)} (expected 0.50000, error: ${Math.abs(mean - expectedMean).toFixed(5)})`
  );
  console.log(
    `    [PRNG Stats]: Sample Variance = ${variance.toFixed(5)} (expected 0.08333, error: ${Math.abs(variance - expectedVariance).toFixed(5)})`
  );

  assert.ok(
    Math.abs(mean - expectedMean) < 0.005,
    `Sample mean ${mean} deviates too much from expected 0.5`
  );
  assert.ok(
    Math.abs(variance - expectedVariance) < 0.005,
    `Sample variance ${variance} deviates too much from expected 0.08333`
  );

  // Chi-Square Goodness of Fit Test (df = 9, critical p=0.01 is 21.67)
  const expectedPerBin = totalSamples / numBins;
  let chiSquare = 0;
  for (let b = 0; b < numBins; b++) {
    const obs = bins[b];
    chiSquare += Math.pow(obs - expectedPerBin, 2) / expectedPerBin;
  }

  console.log(
    `    [PRNG Stats]: Chi-Square Statistic = ${chiSquare.toFixed(2)} (df: 9, critical p=0.01: 21.67)`
  );
  assert.ok(
    chiSquare < 21.67,
    `Chi-Square statistic ${chiSquare.toFixed(2)} exceeds critical value 21.67`
  );
});

// -----------------------------------------------------------------------------
// SECTION 2: GEODETIC LATITUDE COSINE SCALING & BOUNDARY CONTAINMENT
// -----------------------------------------------------------------------------
console.log('\n[SECTION 2] Geodetic Latitude Cosine Scaling & Boundary Containment:');

const TARGET_LATITUDES = [
  { name: 'Equator (0°)', lat: 0.0, lng: 0.0 },
  { name: 'London (51.5°)', lat: 51.5074, lng: -0.1278 },
  { name: 'Oslo (59.9°)', lat: 59.9139, lng: 10.7522 },
  { name: 'Tromsø (69.6°)', lat: 69.6492, lng: 18.9553 }
];

const TEST_RADII = [50, 100, 250, 500, 1000, 2000];

challenge('Boundary Containment across 500+ generated seeds per target latitude: 100.0% containment strictly inside boundaryRadius (0 breaches)', () => {
  let totalItemsChecked = 0;
  let maxRatioObserved = 0;
  let breaches = 0;

  for (const loc of TARGET_LATITUDES) {
    let locItems = 0;
    let locMaxRatio = 0;

    for (let s = 1; s <= 500; s++) {
      const radius = TEST_RADII[s % TEST_RADII.length];
      const matchId = `MATCH_${loc.name.slice(0, 3).toUpperCase()}_${s}`;
      const items = generateMatchCollectibles(matchId, loc.lat, loc.lng, radius);

      assert.strictEqual(items.length, 14, `Expected 14 items, got ${items.length}`);

      for (const item of items) {
        totalItemsChecked++;
        locItems++;
        const dist = getDistance(loc.lat, loc.lng, item.lat, item.lng);
        const ratio = dist / radius;
        if (ratio > maxRatioObserved) maxRatioObserved = ratio;
        if (ratio > locMaxRatio) locMaxRatio = ratio;

        if (dist > radius) {
          breaches++;
          console.error(
            `    BREACH: Item ${item.id} at [${item.lat}, ${item.lng}] distance ${dist.toFixed(2)}m > boundary ${radius}m (ratio ${(ratio * 100).toFixed(2)}%) at ${loc.name}`
          );
        }
      }
    }

    console.log(
      `    [Containment]: ${loc.name} -> Checked ${locItems.toLocaleString()} items across 500 seeds. Max dist/radius = ${(locMaxRatio * 100).toFixed(2)}%`
    );
  }

  console.log(
    `    [Total Containment]: Checked ${totalItemsChecked.toLocaleString()} items across 2,000 matches. Total breaches = ${breaches}`
  );
  assert.strictEqual(breaches, 0, `Expected 0 boundary breaches across all 500+ seeds, found ${breaches}`);
  assert.ok(
    maxRatioObserved <= 0.90,
    `Max distance ratio ${(maxRatioObserved * 100).toFixed(2)}% exceeds theoretical bound of ~88%`
  );
});

challenge('Radial isotropy: collectible distribution does not deform into an ellipse at high latitudes (Oslo 59.9°, Tromsø 69.6°)', () => {
  const radius = 1000;
  const numMatches = 200;

  for (const zone of TARGET_LATITUDES) {
    let sumDistNorthSouth = 0;
    let sumDistEastWest = 0;
    let count = 0;

    for (let m = 0; m < numMatches; m++) {
      const matchId = `ISOTROPY_${zone.name.slice(0, 3).toUpperCase()}_${m}`;
      const items = generateMatchCollectibles(matchId, zone.lat, zone.lng, radius);
      for (const item of items) {
        const dLatMeters = getDistance(zone.lat, zone.lng, item.lat, zone.lng);
        const dLngMeters = getDistance(zone.lat, zone.lng, zone.lat, item.lng);
        sumDistNorthSouth += dLatMeters;
        sumDistEastWest += dLngMeters;
        count++;
      }
    }

    const avgNS = sumDistNorthSouth / count;
    const avgEW = sumDistEastWest / count;
    const ratio = avgEW / avgNS;

    console.log(
      `    [Isotropy ${zone.name}]: Avg E-W = ${avgEW.toFixed(1)}m, Avg N-S = ${avgNS.toFixed(1)}m, Ratio = ${ratio.toFixed(3)}`
    );

    assert.ok(
      ratio >= 0.90 && ratio <= 1.10,
      `Radial isotropy failed at ${zone.name}: EW/NS ratio ${ratio.toFixed(3)} indicates elliptical deformation`
    );
  }
});

// -----------------------------------------------------------------------------
// SECTION 3: PROXIMITY EDGE CASES (9.99m VS 10.01m) AGAINST LIVE SERVER API
// -----------------------------------------------------------------------------
console.log('\n[SECTION 3] Proximity Edge Cases (9.99m vs 10.01m) against Live Server Endpoint:');

const COMPASS_BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

await asyncChallenge('Live HTTP Proximity: 9.99m (inside 10.0m radius) is accepted across all latitudes and compass bearings', async () => {
  let passedCombos = 0;

  for (const loc of TARGET_LATITUDES) {
    for (const b of COMPASS_BEARINGS) {
      const matchId = `PROX_999_${loc.name.slice(0, 3).toUpperCase()}_${b}`;
      mockMatches.set(matchId, {
        id: matchId,
        gameMode: 'treasure_hunt',
        status: 'hunting'
      });

      // Keep match active by adding an uncollected bounty crystal
      mockCollectibles.push({
        id: `${matchId}_anchor_crystal`,
        matchId,
        type: 'bounty_crystal',
        lat: loc.lat,
        lng: loc.lng,
        points: 150,
        isCollected: false
      });

      const pt999 = destinationPoint(loc.lat, loc.lng, 9.99, b);
      const itemId999 = `${matchId}_cube_999`;
      mockCollectibles.push({
        id: itemId999,
        matchId,
        type: 'energy_cube',
        lat: loc.lat,
        lng: loc.lng,
        points: 50,
        isCollected: false
      });

      const userId = `user_999_${matchId}`;
      mockProfiles.set(userId, {
        id: userId,
        lat: pt999.lat,
        lng: pt999.lng,
        score: 0
      });

      const res = await fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': userId },
        body: JSON.stringify({ itemId: itemId999 })
      });

      const data = await res.json();
      assert.strictEqual(
        res.status,
        200,
        `Expected HTTP 200 at 9.99m (${loc.name}, bearing ${b}°), but got ${res.status}: ${JSON.stringify(data)}`
      );
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.points, 50);
      passedCombos++;
    }
  }

  console.log(`    [9.99m Verification]: 32/32 combinations passed with HTTP 200.`);
  assert.strictEqual(passedCombos, 32);
});

await asyncChallenge('Live HTTP Proximity: 10.01m (strictly outside 10.0m radius) MUST BE REJECTED with HTTP 400', async () => {
  const failures = [];
  let rejectedCount = 0;

  for (const loc of TARGET_LATITUDES) {
    for (const b of COMPASS_BEARINGS) {
      const matchId = `PROX_1001_${loc.name.slice(0, 3).toUpperCase()}_${b}`;
      mockMatches.set(matchId, {
        id: matchId,
        gameMode: 'treasure_hunt',
        status: 'hunting'
      });

      // Anchor crystal so match stays active
      mockCollectibles.push({
        id: `${matchId}_anchor_crystal`,
        matchId,
        type: 'bounty_crystal',
        lat: loc.lat,
        lng: loc.lng,
        points: 150,
        isCollected: false
      });

      const pt1001 = destinationPoint(loc.lat, loc.lng, 10.01, b);
      const itemId1001 = `${matchId}_cube_1001`;
      mockCollectibles.push({
        id: itemId1001,
        matchId,
        type: 'energy_cube',
        lat: loc.lat,
        lng: loc.lng,
        points: 50,
        isCollected: false
      });

      const userId = `user_1001_${matchId}`;
      mockProfiles.set(userId, {
        id: userId,
        lat: pt1001.lat,
        lng: pt1001.lng,
        score: 0
      });

      const res = await fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': userId },
        body: JSON.stringify({ itemId: itemId1001 })
      });

      const data = await res.json();
      const distActual = getDistance(loc.lat, loc.lng, pt1001.lat, pt1001.lng);

      if (res.status === 400 && data.error && data.error.includes('Too far')) {
        rejectedCount++;
      } else {
        failures.push({
          loc: loc.name,
          bearing: b,
          distActual,
          status: res.status,
          response: data
        });
      }
    }
  }

  console.log(`    [10.01m Verification]: ${rejectedCount}/32 rejected with HTTP 400. ${failures.length}/32 erroneously ACCEPTED with HTTP 200.`);
  if (failures.length > 0) {
    console.error(`    DEFECT FOUND: Server lines 2047 & 2095 evaluate "dist > collectRadius + 0.01", allowing 10.01m collections!`);
    failures.slice(0, 3).forEach(f => {
      console.error(`      - ${f.loc} at ${f.bearing}° (dist=${f.distActual.toFixed(8)}m): HTTP ${f.status}`);
    });
    assert.fail(
      `CRITICAL BOUNDARY DEFECT: 10.01m collection succeeded in ${failures.length} cases due to "collectRadius + 0.01" threshold in server/index.ts`
    );
  }
});

// -----------------------------------------------------------------------------
// SECTION 4: CONCURRENCY & ATOMIC DOUBLE-COLLECTION (LIVE HTTP SERVER)
// -----------------------------------------------------------------------------
console.log('\n[SECTION 4] Concurrency & Double Collection Protection (Live Express API):');

await asyncChallenge('Two simultaneous collection requests for the exact same crystal: exactly 1 succeeds, 1 is rejected', async () => {
  const matchId = 'CONC_2_PLAYERS';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'treasure_hunt',
    status: 'hunting'
  });

  const itemId = `${matchId}_crystal_1`;
  const crystal = {
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
  mockCollectibles.push(crystal);

  mockProfiles.set('simul_player_a', { id: 'simul_player_a', lat: 59.9139, lng: 10.7522, score: 0 });
  mockProfiles.set('simul_player_b', { id: 'simul_player_b', lat: 59.9139, lng: 10.7522, score: 0 });

  const [resA, resB] = await Promise.all([
    fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'simul_player_a' },
      body: JSON.stringify({ itemId })
    }),
    fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-dev-user-id': 'simul_player_b' },
      body: JSON.stringify({ itemId })
    })
  ]);

  const [dataA, dataB] = await Promise.all([resA.json(), resB.json()]);

  const statuses = [resA.status, resB.status];
  const successes = statuses.filter(s => s === 200).length;
  const rejections = statuses.filter(s => s === 400).length;

  console.log(`    [Concurrency 2 Players]: ${successes} succeeded (HTTP 200), ${rejections} rejected (HTTP 400)`);
  assert.strictEqual(successes, 1, 'Exactly one concurrent collection request must succeed');
  assert.strictEqual(rejections, 1, 'The competing concurrent collection request must be rejected');

  const totalScore = mockProfiles.get('simul_player_a').score + mockProfiles.get('simul_player_b').score;
  assert.strictEqual(totalScore, 150, 'Total points awarded must be exactly 150 (no duplicate XP)');
});

await asyncChallenge('50 concurrent competing requests for the same Bounty Crystal: exactly 1 succeeds, 49 rejected', async () => {
  const matchId = 'CONC_50_PLAYERS';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'treasure_hunt',
    status: 'hunting'
  });

  const itemId = `${matchId}_crystal_grand_prize`;
  const crystal = {
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
  mockCollectibles.push(crystal);

  const numPlayers = 50;
  const playerIds = Array.from({ length: numPlayers }, (_, i) => `swarm_player_${i}`);
  playerIds.forEach(id => {
    mockProfiles.set(id, { id, lat: 59.9139, lng: 10.7522, score: 0 });
  });

  const responses = await Promise.all(
    playerIds.map(id =>
      fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': id },
        body: JSON.stringify({ itemId })
      }).then(async r => ({ status: r.status, data: await r.json() }))
    )
  );

  const successfulClaims = responses.filter(r => r.status === 200);
  const rejectedClaims = responses.filter(r => r.status === 400);

  console.log(`    [Concurrency 50 Players]: ${successfulClaims.length} HTTP 200, ${rejectedClaims.length} HTTP 400`);
  assert.strictEqual(successfulClaims.length, 1, 'Exactly one player out of 50 may collect the item');
  assert.strictEqual(rejectedClaims.length, 49, '49 out of 50 players must receive HTTP 400');

  const totalScore = playerIds.reduce((acc, id) => acc + mockProfiles.get(id).score, 0);
  assert.strictEqual(totalScore, 150, 'Total score across all 50 players must be exactly 150');
  assert.strictEqual(crystal.isCollected, true);
});

await asyncChallenge('Single player rapid double-click replay attack: score increments only once', async () => {
  const matchId = 'REPLAY_TEST';
  mockMatches.set(matchId, {
    id: matchId,
    gameMode: 'treasure_hunt',
    status: 'hunting'
  });

  const itemId = `${matchId}_cube_replay`;
  mockCollectibles.push({
    id: itemId,
    matchId,
    type: 'energy_cube',
    lat: 59.9139,
    lng: 10.7522,
    points: 50,
    isCollected: false,
    collectedById: null,
    collectedAt: null
  });

  const userId = 'fast_clicker';
  mockProfiles.set(userId, { id: userId, lat: 59.9139, lng: 10.7522, score: 100 });

  // 10 simultaneous requests from the same user
  const responses = await Promise.all(
    Array.from({ length: 10 }, () =>
      fetch(`${baseUrl}/api/matches/${matchId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-user-id': userId },
        body: JSON.stringify({ itemId })
      }).then(async r => ({ status: r.status, data: await r.json() }))
    )
  );

  const successes = responses.filter(r => r.status === 200);
  const failures = responses.filter(r => r.status === 400);

  console.log(`    [Replay Attack]: ${successes.length} HTTP 200, ${failures.length} HTTP 400`);
  assert.strictEqual(successes.length, 1, 'Only 1 of 10 rapid clicks may succeed');
  assert.strictEqual(failures.length, 9, '9 of 10 rapid clicks must be rejected');
  assert.strictEqual(mockProfiles.get(userId).score, 150, 'Player score must be 100 + 50 = 150');
});

// Close test HTTP server
server.close();

// -----------------------------------------------------------------------------
// SUMMARY & VERDICT
// -----------------------------------------------------------------------------
console.log('\n================================================================================');
console.log(`  CHALLENGE SUITE SUMMARY: ${passedTests} passed, ${failedTests} failed`);
console.log('================================================================================\n');

if (failedTests > 0) {
  console.error('FAILURES DETECTED:');
  failureDetails.forEach((f, i) => {
    console.error(`  ${i + 1}. ${f.title}`);
    console.error(`     ${f.error}\n`);
  });
  process.exit(1);
} else {
  console.log('  ALL EMPIRICAL CHALLENGES SATISFIED WITHOUT DEFECT.\n');
  process.exit(0);
}
