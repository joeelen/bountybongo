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

async function main() {
  console.log(`Starting Bountyrunner Automated Test Suite...`);

  // Register all tiers
  registerTier1Tests();
  registerTier2Tests();
  registerTier3Tests();
  registerTier4Tests();

  // Execute all registered suites
  const summary = await runner.runAll();

  // Exit with standard semantics: 0 on complete pass, 1 on any failure
  process.exit(summary.failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
