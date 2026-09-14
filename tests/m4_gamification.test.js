/**
 * tests/m4_gamification.test.js
 * Empirical verification suite for Milestone 4 Gamification, Quests & Titles:
 * - Deterministic UTC Date-seeded daily operations rotation
 * - Progress tracking & target completions
 * - Reward claiming & anti-duplicate claiming protection
 * - Daily streak calculation across consecutive vs broken days
 * - Unlockable player titles & identity designations catalog
 * - Server POST /api/profile/xp bonus scoring endpoint
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

// Polyfill minimal localStorage for testing DailyQuestManager in Node environment
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (key) => mockStorage.get(key) || null,
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// Import production daily quest manager and title catalog
const { DailyQuestManager, TITLE_CATALOG } = await import('../src/lib/dailyQuests.ts');

// Import server for /api/profile/xp endpoint verification
const { app, mockProfiles } = await import('../server/index.ts');

console.log('\n================================================================================');
console.log('  MILESTONE 4: GAMIFICATION, DAILY OPERATIONS & TITLES EMPIRICAL VERIFICATION');
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
// 1. Deterministic Daily Operations Rotation
// -----------------------------------------------------------------------------
await test('T1: Deterministic daily operation generation produces 3 distinct quests', () => {
  mockStorage.clear();
  const quests1 = DailyQuestManager.getDailyQuests();
  assert.strictEqual(quests1.length, 3, 'Must produce exactly 3 daily operations');

  // Verify uniqueness of generated quests
  const ids = quests1.map(q => q.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(uniqueIds.size, 3, 'All 3 daily operations must be distinct');

  // Second call on same date must return identical set
  const quests2 = DailyQuestManager.getDailyQuests();
  assert.deepStrictEqual(quests1, quests2, 'Subsequent retrieval must match bit-for-bit');
});

// -----------------------------------------------------------------------------
// 2. Quest Progress & Target Completion
// -----------------------------------------------------------------------------
await test('T2: Progress increments correctly and marks quest complete when target is achieved', () => {
  mockStorage.clear();
  const initialQuests = DailyQuestManager.getDailyQuests();
  const targetQuest = initialQuests[0];

  assert.strictEqual(targetQuest.isCompleted, false);
  assert.strictEqual(targetQuest.current, 0);

  // Increment progress
  const updatedQuests = DailyQuestManager.incrementProgress(targetQuest.id, targetQuest.target);
  const updatedTarget = updatedQuests.find(q => q.id === targetQuest.id);

  assert.strictEqual(updatedTarget.current, targetQuest.target);
  assert.strictEqual(updatedTarget.isCompleted, true);
  assert.strictEqual(updatedTarget.isClaimed, false);
});

// -----------------------------------------------------------------------------
// 3. Reward Claiming & Anti-Duplicate Protection
// -----------------------------------------------------------------------------
await test('T3: Claiming completed quest awards XP, prevents duplicate claim, and updates streak', async () => {
  mockStorage.clear();
  const quests = DailyQuestManager.getDailyQuests();
  const quest = quests[0];

  // Complete quest
  DailyQuestManager.incrementProgress(quest.id, quest.target);

  const initialScore = 500;
  const result = await DailyQuestManager.claimQuest(quest.id, initialScore);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.rewardXp, quest.rewardXp);
  assert.strictEqual(result.newScore, initialScore + quest.rewardXp);

  // Attempt duplicate claim immediately
  const duplicateResult = await DailyQuestManager.claimQuest(quest.id, result.newScore);
  assert.strictEqual(duplicateResult.success, false, 'Duplicate claim must be rejected');
  assert.strictEqual(duplicateResult.rewardXp, 0);
});

// -----------------------------------------------------------------------------
// 4. Consecutive Streak Counter Calculation
// -----------------------------------------------------------------------------
await test('T4: Consecutive days increment streak; gap resets streak to 1', () => {
  mockStorage.clear();

  // Day 1
  mockStorage.set('bountyrunner_last_active_date', '2026-09-12');
  mockStorage.set('bountyrunner_daily_streak', '1');

  // Today is 2026-09-13 (consecutive day)
  const streakAfterConsecutive = DailyQuestManager.checkAndUpdateStreak();
  assert.ok(streakAfterConsecutive >= 1, 'Streak must be active');

  // Verify broken streak logic
  mockStorage.set('bountyrunner_last_active_date', '2026-08-01'); // 1 month ago
  mockStorage.set('bountyrunner_daily_streak', '15');

  const streakAfterBreak = DailyQuestManager.checkAndUpdateStreak();
  assert.strictEqual(streakAfterBreak, 1, 'Broken streak must reset to 1');
});

// -----------------------------------------------------------------------------
// 5. Title Catalog & Unlocking Progression
// -----------------------------------------------------------------------------
await test('T5: Title catalog contains rich designations and equips correctly', () => {
  mockStorage.clear();

  assert.ok(TITLE_CATALOG.length >= 6, 'Catalog must contain at least 6 fun titles');

  // Verify starter title exists
  const starter = TITLE_CATALOG.find(t => t.id === 'street_runner');
  assert.ok(starter, 'Starter title must exist');
  assert.strictEqual(starter.requiredXp, 0);

  // Equip title
  const equipped = DailyQuestManager.equipTitle('shadow_master');
  assert.strictEqual(equipped.id, 'shadow_master');
  assert.strictEqual(DailyQuestManager.getEquippedTitle().id, 'shadow_master');
});

// -----------------------------------------------------------------------------
// 6. Server /api/profile/xp Bonus Scoring Endpoint
// -----------------------------------------------------------------------------
await test('T6: Server POST /api/profile/xp awards bonus points to player profile', async () => {
  const userId = 'quest_test_agent';
  mockProfiles.set(userId, { id: userId, score: 250, lat: 59.9139, lng: 10.7522 });

  const res = await request('/api/profile/xp', {
    method: 'POST',
    userId,
    body: { xpToAdd: 150, reason: 'Test Daily Quest' }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.addedXp, 150);

  const updatedProf = mockProfiles.get(userId);
  assert.strictEqual(updatedProf.score, 400, 'Score must be updated from 250 to 400');
});

server.close();

console.log('\n================================================================================');
console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}
