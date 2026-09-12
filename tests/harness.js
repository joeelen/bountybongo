/**
 * tests/harness.js
 * Standalone, lightweight test harness for Bountyrunner automated testing.
 * Provides describe, test/it, assertions, and formatted tier execution reporting.
 */
import assert from 'node:assert/strict';

export { assert };

class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
  }

  addTest(name, fn) {
    this.tests.push({ name, fn });
  }
}

class TestRunner {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.tierSummaries = [];
  }

  describe(name, fn) {
    const suite = new TestSuite(name);
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {});
    }
    this.currentSuite.addTest(name, fn);
  }

  async runSuite(suite) {
    console.log(`\n================================================================================`);
    console.log(`  ${suite.name}`);
    console.log(`================================================================================`);

    let passed = 0;
    let failed = 0;
    const failures = [];
    const startTime = Date.now();

    for (const t of suite.tests) {
      const testStart = performance.now();
      try {
        await t.fn();
        const duration = (performance.now() - testStart).toFixed(2);
        console.log(`  ✓ ${t.name} (${duration}ms)`);
        passed++;
      } catch (err) {
        const duration = (performance.now() - testStart).toFixed(2);
        console.error(`  ✗ ${t.name} (${duration}ms)`);
        console.error(`    Error: ${err.message}`);
        failed++;
        failures.push({ name: t.name, error: err });
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`\n  [Summary: ${passed} passed, ${failed} failed in ${durationMs}ms]`);

    return {
      name: suite.name,
      total: suite.tests.length,
      passed,
      failed,
      durationMs,
      failures
    };
  }

  async runAll() {
    const overallStart = Date.now();
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const allFailures = [];

    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`  BOUNTYRUNNER AUTOMATED E2E & LAYOUT TEST RUNNER`);
    console.log(`  Environment: Node.js ${process.version} | Timestamp: ${new Date().toISOString()}`);
    console.log(`--------------------------------------------------------------------------------`);

    for (const suite of this.suites) {
      const summary = await this.runSuite(suite);
      totalTests += summary.total;
      totalPassed += summary.passed;
      totalFailed += summary.failed;
      if (summary.failures.length > 0) {
        allFailures.push(...summary.failures);
      }
      this.tierSummaries.push(summary);
    }

    const overallDuration = Date.now() - overallStart;

    console.log(`\n================================================================================`);
    console.log(`  FINAL RUN SUMMARY`);
    console.log(`================================================================================`);
    for (const ts of this.tierSummaries) {
      const statusIcon = ts.failed === 0 ? '✓ PASS' : '✗ FAIL';
      console.log(`  ${statusIcon.padEnd(8)} ${ts.name.padEnd(65)} (${ts.passed}/${ts.total})`);
    }
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`  TOTAL: ${totalTests} tests executed | ${totalPassed} passed | ${totalFailed} failed`);
    console.log(`  TIME:  ${(overallDuration / 1000).toFixed(2)}s`);
    console.log(`================================================================================\n`);

    if (totalFailed > 0) {
      console.error(`🚨 TEST FAILURES DETECTED (${totalFailed} failed):`);
      for (const f of allFailures) {
        console.error(`  - ${f.name}: ${f.error.message}`);
      }
    }

    return {
      total: totalTests,
      passed: totalPassed,
      failed: totalFailed,
      durationMs: overallDuration,
      failures: allFailures
    };
  }
}

export const runner = new TestRunner();
export const describe = runner.describe.bind(runner);
export const test = runner.test.bind(runner);
export const it = test;
