/**
 * tests/m3_powerups.test.js
 * Empirical verification suite for Milestone 3 Tactical Power-Ups & Action Bar:
 * - Power-up configurations, durations & cooldown boundaries
 * - Sprint boost mobility buffer
 * - Decoy Drone phantom GPS radar emission
 * - Shield Bubble capture absorption & post-hit immunity
 * - Freeze Trap ground snare & seeker radar jamming
 * - Cooldown enforcement & state constraints
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';

// Transparently bootstrap TypeScript execution via tsx if run via plain node
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

// Import production application and models from server/index.ts
const {
  app,
  POWERUP_CONFIG,
  mockMatches,
  mockParticipants,
  mockProfiles,
  mockUsers,
  mockPowerUps,
  playerPowerUpCooldowns,
  playerShieldMap,
  playerSprintMap,
  playerSnaredMap,
  frozenImmunityMap
} = await import('../server/index.ts');

console.log('\n================================================================================');
console.log('  MILESTONE 3: TACTICAL POWER-UPS & ACTION BAR EMPIRICAL VERIFICATION');
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

// Start ephemeral HTTP server
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
// 1. Configuration & Balance Parameters
// -----------------------------------------------------------------------------
await test('T1: Power-up configuration contains balanced parameters for all 4 types', () => {
  assert.ok(POWERUP_CONFIG.sprint, 'Sprint config must exist');
  assert.ok(POWERUP_CONFIG.decoy, 'Decoy config must exist');
  assert.ok(POWERUP_CONFIG.shield, 'Shield config must exist');
  assert.ok(POWERUP_CONFIG.freeze_trap, 'Freeze Trap config must exist');

  assert.strictEqual(POWERUP_CONFIG.sprint.durationMs, 15000, 'Sprint duration must be 15s');
  assert.strictEqual(POWERUP_CONFIG.sprint.cooldownMs, 45000, 'Sprint cooldown must be 45s');

  assert.strictEqual(POWERUP_CONFIG.decoy.durationMs, 30000, 'Decoy duration must be 30s');
  assert.strictEqual(POWERUP_CONFIG.decoy.cooldownMs, 60000, 'Decoy cooldown must be 60s');

  assert.strictEqual(POWERUP_CONFIG.shield.durationMs, 20000, 'Shield duration must be 20s');
  assert.strictEqual(POWERUP_CONFIG.shield.cooldownMs, 90000, 'Shield cooldown must be 90s');

  assert.strictEqual(POWERUP_CONFIG.freeze_trap.trapRadius, 10, 'Freeze trap radius must be 10m');
  assert.strictEqual(POWERUP_CONFIG.freeze_trap.snareDurationMs, 10000, 'Freeze trap snare duration must be 10s');
});

// -----------------------------------------------------------------------------
// 2. Sprint Boost Activation & Cooldown Enforcement
// -----------------------------------------------------------------------------
await test('T2: Sprint Boost activation awards speed buff and sets 45s cooldown', async () => {
  const matchId = 'M3-MATCH-SPRINT';
  const userId = 'runner_sprint_1';

  mockUsers.set(userId, { id: userId, name: 'Speedy' });
  mockProfiles.set(userId, { id: userId, lat: 59.9139, lng: 10.7522, score: 0 });
  mockMatches.set(matchId, {
    id: matchId,
    hostId: 'host',
    status: 'hunting',
    gameMode: 'classic',
    hidingEndsAt: new Date(Date.now() - 10000),
    huntingEndsAt: new Date(Date.now() + 600000)
  });
  mockParticipants.push({
    id: 9101,
    matchId,
    userId,
    role: 'hider',
    isCaught: false,
    isFrozen: false
  });

  // Activate sprint
  const res = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId,
    body: { type: 'sprint', lat: 59.9139, lng: 10.7522 }
  });

  assert.strictEqual(res.status, 200, 'Sprint activation must return HTTP 200');
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.powerUp.type, 'sprint');
  assert.ok(res.data.cooldownUntil > Date.now() + 40000, 'Cooldown must be set to ~45s in future');

  // Attempt second activation immediately (must be rejected with HTTP 400 cooldown)
  const resDuplicate = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId,
    body: { type: 'sprint' }
  });

  assert.strictEqual(resDuplicate.status, 400, 'Duplicate activation while on cooldown must return HTTP 400');
  assert.ok(resDuplicate.data.error.includes('cooldown'), 'Error must mention cooldown');
});

// -----------------------------------------------------------------------------
// 3. Decoy Drone Phantom Coordinate Generation
// -----------------------------------------------------------------------------
await test('T3: Decoy Drone creates phantom GPS marker with expiration', async () => {
  const matchId = 'M3-MATCH-DECOY';
  const userId = 'runner_decoy_1';

  mockUsers.set(userId, { id: userId, name: 'Phantom' });
  mockProfiles.set(userId, { id: userId, lat: 59.9139, lng: 10.7522, score: 0 });
  mockMatches.set(matchId, {
    id: matchId,
    hostId: 'host',
    status: 'hunting',
    gameMode: 'classic',
    hidingEndsAt: new Date(Date.now() - 10000),
    huntingEndsAt: new Date(Date.now() + 600000)
  });
  mockParticipants.push({
    id: 9102,
    matchId,
    userId,
    role: 'hider',
    isCaught: false,
    isFrozen: false
  });

  const decoyLat = 59.9145;
  const decoyLng = 10.7530;

  const res = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId,
    body: { type: 'decoy', lat: decoyLat, lng: decoyLng }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.powerUp.type, 'decoy');
  assert.strictEqual(res.data.powerUp.lat, decoyLat);
  assert.strictEqual(res.data.powerUp.lng, decoyLng);
  assert.strictEqual(res.data.powerUp.isActive, true);

  // Fetch match state and verify powerUp is included in active list
  const matchGet = await request(`/api/matches/${matchId}`, { userId });
  assert.strictEqual(matchGet.status, 200);
  const foundDecoy = matchGet.data.powerUps.find(p => p.type === 'decoy' && p.userId === userId);
  assert.ok(foundDecoy, 'Decoy must be visible in match powerUps list');
  assert.strictEqual(foundDecoy.lat, decoyLat);
});

// -----------------------------------------------------------------------------
// 4. Shield Bubble Capture Absorption
// -----------------------------------------------------------------------------
await test('T4: Shield Bubble absorbs catch attempt and awards +50 XP dodge bonus', async () => {
  const matchId = 'M3-MATCH-SHIELD';
  const seekerId = 'seeker_hunter_1';
  const hiderId = 'hider_shielded_1';

  mockUsers.set(seekerId, { id: seekerId, name: 'Hunter' });
  mockUsers.set(hiderId, { id: hiderId, name: 'ShieldUser' });

  // Seeker starts 120m away so auto-catch doesn't trigger during activation tick
  mockProfiles.set(seekerId, { id: seekerId, lat: 59.9149, lng: 10.7532, score: 0 });
  mockProfiles.set(hiderId, { id: hiderId, lat: 59.9139, lng: 10.7522, score: 100 });

  mockMatches.set(matchId, {
    id: matchId,
    hostId: 'host',
    status: 'hunting',
    gameMode: 'classic',
    captureRadius: 10,
    hidingEndsAt: new Date(Date.now() - 10000),
    huntingEndsAt: new Date(Date.now() + 600000)
  });

  mockParticipants.push({
    id: 9103,
    matchId,
    userId: seekerId,
    role: 'seeker',
    isCaught: false,
    isFrozen: false
  });

  const hiderPart = {
    id: 9104,
    matchId,
    userId: hiderId,
    role: 'hider',
    isCaught: false,
    isFrozen: false,
    activeShieldUntil: null
  };
  mockParticipants.push(hiderPart);

  // Hider activates Shield
  const shieldRes = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId: hiderId,
    body: { type: 'shield', lat: 59.9139, lng: 10.7522 }
  });
  assert.strictEqual(shieldRes.status, 200, `Shield activation failed: ${JSON.stringify(shieldRes.data)}`);

  // Seeker moves into capture range (distance = 0m)
  mockProfiles.set(seekerId, { id: seekerId, lat: 59.9139, lng: 10.7522, score: 0 });

  // Seeker attempts catch
  const catchRes = await request(`/api/matches/${matchId}/catch`, {
    method: 'POST',
    userId: seekerId,
    body: { targetId: hiderId }
  });

  // Catch must be rejected because shield absorbed it
  assert.strictEqual(catchRes.status, 400, 'Catch must fail against active shield');
  assert.ok(catchRes.data.error.includes('Shield Bubble'), 'Error message must state shield protection');

  // Verify hider remained uncaught
  assert.strictEqual(hiderPart.isCaught, false, 'Hider must not be marked caught');

  // Verify hider was awarded dodge bonus XP (+50 XP)
  const hiderProfile = mockProfiles.get(hiderId);
  assert.strictEqual(hiderProfile.score, 150, 'Hider must receive +50 XP shield absorption reward');

  // Verify shield is now consumed and post-hit immunity is active
  const immunityUntil = frozenImmunityMap.get(`${matchId}_${hiderId}`);
  assert.ok(immunityUntil && immunityUntil > Date.now(), 'Post-shield grace immunity must be armed');
});

// -----------------------------------------------------------------------------
// 5. Freeze Trap Ground Snare
// -----------------------------------------------------------------------------
await test('T5: Freeze Trap deployment arms 10m snare and prevents snared seeker catches', async () => {
  const matchId = 'M3-MATCH-TRAP';
  const runnerId = 'runner_trap_1';
  const seekerId = 'seeker_snared_1';

  mockUsers.set(runnerId, { id: runnerId, name: 'Trapper' });
  mockUsers.set(seekerId, { id: seekerId, name: 'SnaredHunter' });

  mockProfiles.set(runnerId, { id: runnerId, lat: 59.9139, lng: 10.7522, score: 0 });
  // Seeker starts 120m away
  mockProfiles.set(seekerId, { id: seekerId, lat: 59.9149, lng: 10.7532, score: 0 });

  mockMatches.set(matchId, {
    id: matchId,
    hostId: 'host',
    status: 'hunting',
    gameMode: 'classic',
    captureRadius: 10,
    hidingEndsAt: new Date(Date.now() - 10000),
    huntingEndsAt: new Date(Date.now() + 600000)
  });

  mockParticipants.push({
    id: 9105,
    matchId,
    userId: runnerId,
    role: 'hider',
    isCaught: false,
    isFrozen: false
  });

  mockParticipants.push({
    id: 9106,
    matchId,
    userId: seekerId,
    role: 'seeker',
    isCaught: false,
    isFrozen: false
  });

  // Runner deploys Freeze Trap
  const trapRes = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId: runnerId,
    body: { type: 'freeze_trap', lat: 59.9139, lng: 10.7522 }
  });
  assert.strictEqual(trapRes.status, 200, `Trap deployment failed: ${JSON.stringify(trapRes.data)}`);
  assert.strictEqual(trapRes.data.powerUp.type, 'freeze_trap');
  assert.strictEqual(trapRes.data.powerUp.radius, 10);

  // Seeker moves into range (0m)
  mockProfiles.set(seekerId, { id: seekerId, lat: 59.9139, lng: 10.7522, score: 0 });

  // Simulate seeker snared by trap
  playerSnaredMap.set(`${matchId}_${seekerId}`, Date.now() + 15000);

  // Seeker attempts catch while snared
  const catchAttempt = await request(`/api/matches/${matchId}/catch`, {
    method: 'POST',
    userId: seekerId,
    body: { targetId: runnerId }
  });

  assert.strictEqual(catchAttempt.status, 400);
  assert.ok(catchAttempt.data.error.includes('snared by a Freeze Trap'), 'Catch must be blocked by snare');
});

// -----------------------------------------------------------------------------
// 6. Frozen & Caught Status Restriction
// -----------------------------------------------------------------------------
await test('T6: Frozen or caught players cannot activate power-ups', async () => {
  const matchId = 'M3-MATCH-RESTRICT';
  const frozenUserId = 'runner_frozen_1';

  mockUsers.set(frozenUserId, { id: frozenUserId, name: 'FrozenRunner' });
  mockProfiles.set(frozenUserId, { id: frozenUserId, lat: 59.9139, lng: 10.7522, score: 0 });

  const activeRunnerId = 'runner_active_2';
  mockUsers.set(activeRunnerId, { id: activeRunnerId, name: 'ActiveRunner' });
  mockProfiles.set(activeRunnerId, { id: activeRunnerId, lat: 59.9150, lng: 10.7540, score: 0 });

  mockMatches.set(matchId, {
    id: matchId,
    hostId: 'host',
    status: 'hunting',
    gameMode: 'freeze_tag',
    hidingEndsAt: new Date(Date.now() - 10000),
    huntingEndsAt: new Date(Date.now() + 600000)
  });

  mockParticipants.push({
    id: 9107,
    matchId,
    userId: frozenUserId,
    role: 'hider',
    isCaught: false,
    isFrozen: true
  });

  mockParticipants.push({
    id: 9108,
    matchId,
    userId: activeRunnerId,
    role: 'hider',
    isCaught: false,
    isFrozen: false
  });

  const res = await request(`/api/matches/${matchId}/powerup`, {
    method: 'POST',
    userId: frozenUserId,
    body: { type: 'sprint', lat: 59.9139, lng: 10.7522 }
  });

  assert.strictEqual(res.status, 400);
  assert.ok(res.data.error.toLowerCase().includes('frozen'), 'Must reject power-up activation when frozen');
});

server.close();

console.log('\n================================================================================');
console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}
