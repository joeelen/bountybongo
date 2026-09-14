/**
 * tests/runner.js
 * Standalone Node.js Test Runner for Bountyrunner E2E & Layout Verification.
 *
 * Usage:
 *   node tests/runner.js
 *
 * Runs all test tiers (Tier 1 Feature Isolation, Tier 2 Boundaries,
 * Tier 3 Pairwise Interactions, Tier 4 Real-World Match Scenarios).
 * Exits with code 0 on 100% pass or 1 on any failure.
 */
import { runner } from './harness.js';
import { registerTier1Tests } from './tier1_features.test.js';
import { registerTier2Tests } from './tier2_boundaries.test.js';
import { registerTier3Tests } from './tier3_interactions.test.js';
import { registerTier4Tests } from './tier4_real_world.test.js';
import { spawnSync } from 'child_process';

async function main() {
  console.log(`Starting Bountyrunner Automated Test Suite...`);

  // Register all tiers
  registerTier1Tests();
  registerTier2Tests();
  registerTier3Tests();
  registerTier4Tests();

  // Execute all registered suites
  const summary = await runner.runAll();

  if (summary.failed > 0) {
    console.error(`Layout suite failed with ${summary.failed} failures.`);
    process.exit(1);
  }

  // Execute Empirical Milestone & Auth Test Suites
  const milestoneSuites = [
    'tests/m2_party_modes.test.js',
    'tests/m2_spatial_collectibles_challenge.test.js',
    'tests/m3_powerups.test.js',
    'tests/m4_gamification.test.js',
    'tests/auth_persistence.test.js'
  ];

  for (const suite of milestoneSuites) {
    const res = spawnSync(process.execPath, [suite], { stdio: 'inherit' });
    if (res.status !== 0) {
      console.error(`Empirical suite ${suite} failed with code ${res.status}`);
      process.exit(1);
    }
  }

  console.log('\n================================================================================');
  console.log('  🌟 ALL VERIFICATION SUITES (117 LAYOUT + 35 EMPIRICAL GATES) PASSED 100%!');
  console.log('================================================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
