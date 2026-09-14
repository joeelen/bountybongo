/**
 * tests/auth_persistence.test.js
 * Empirical verification suite for Authentication, Persistent Real Accounts & OAuth:
 * - T1: Register with real email, username, password and score transfer
 * - T2: Prevent duplicate username registration (HTTP 409)
 * - T3: Prevent duplicate email registration (HTTP 409)
 * - T4: Login with username + password
 * - T5: Login with real email + password
 * - T6: Reject incorrect password (HTTP 401)
 * - T7: Reject non-existent user with password (HTTP 401)
 * - T8: Dedicated Google OAuth endpoint with real email
 * - T9: Repeat Google OAuth connects to EXACT same account & preserves XP (No random emails!)
 * - T10: Dedicated Apple OAuth endpoint with real email
 * - T11: Reject OAuth with invalid or missing email (HTTP 400)
 * - T12: Social friend search finds user by their real email
 */

import { spawnSync } from 'node:child_process';
import assert from 'node:assert';

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

const { app, mockUsers, mockProfiles } = await import('../server/index.ts');

console.log('\n================================================================================');
console.log('  AUTHENTICATION & REAL CLOUD ACCOUNT PERSISTENCE VERIFICATION');
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
// T1: Registration with Real Email, Username, Password, and Score Transfer
// -----------------------------------------------------------------------------
await test('T1: Register with real email, username, password and score transfer', async () => {
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'TestRunnerAlpha',
      password: 'password123',
      email: 'alpha.runner@example.com',
      transferScore: 175
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.id, 'testrunneralpha');
  assert.strictEqual(res.data.user.email, 'alpha.runner@example.com');
  assert.strictEqual(res.data.user.name, 'TestRunnerAlpha');
  assert.strictEqual(res.data.profile.score, 175);
});

// -----------------------------------------------------------------------------
// T2: Prevent duplicate username registration (HTTP 409)
// -----------------------------------------------------------------------------
await test('T2: Prevent duplicate username registration (HTTP 409)', async () => {
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'testrunneralpha',
      password: 'anotherpassword',
      email: 'different@example.com'
    }
  });

  assert.strictEqual(res.status, 409);
  assert(res.data.error.includes('allerede i bruk'));
});

// -----------------------------------------------------------------------------
// T3: Prevent duplicate email registration (HTTP 409)
// -----------------------------------------------------------------------------
await test('T3: Prevent duplicate email registration (HTTP 409)', async () => {
  const res = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'UniqueNameBeta',
      password: 'password123',
      email: 'alpha.runner@example.com'
    }
  });

  assert.strictEqual(res.status, 409);
  assert(res.data.error.includes('allerede registrert'));
});

// -----------------------------------------------------------------------------
// T4: Login with username + password
// -----------------------------------------------------------------------------
await test('T4: Login with username + password', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: 'TestRunnerAlpha',
      password: 'password123'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.id, 'testrunneralpha');
  assert.strictEqual(res.data.user.email, 'alpha.runner@example.com');
  assert.strictEqual(res.data.profile.score, 175);
});

// -----------------------------------------------------------------------------
// T5: Login with real email + password
// -----------------------------------------------------------------------------
await test('T5: Login with real email + password', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: 'alpha.runner@example.com',
      password: 'password123'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.id, 'testrunneralpha');
  assert.strictEqual(res.data.user.name, 'TestRunnerAlpha');
  assert.strictEqual(res.data.profile.score, 175);
});

// -----------------------------------------------------------------------------
// T6: Reject incorrect password (HTTP 401)
// -----------------------------------------------------------------------------
await test('T6: Reject incorrect password (HTTP 401)', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: 'TestRunnerAlpha',
      password: 'WRONG_PASSWORD_XYZ'
    }
  });

  assert.strictEqual(res.status, 401);
  assert(res.data.error.includes('Feil passord'));
});

// -----------------------------------------------------------------------------
// T7: Reject non-existent user login with password (HTTP 401)
// -----------------------------------------------------------------------------
await test('T7: Reject non-existent user login with password (HTTP 401)', async () => {
  const res = await request('/api/auth/login', {
    method: 'POST',
    body: {
      username: 'GhostUser9999',
      password: 'any_password'
    }
  });

  assert.strictEqual(res.status, 401);
  assert(res.data.error.includes('Fant ingen konto'));
});

// -----------------------------------------------------------------------------
// T8: Dedicated Google OAuth endpoint with real email
// -----------------------------------------------------------------------------
await test('T8: Dedicated Google OAuth endpoint with real email creates persistent account', async () => {
  const res = await request('/api/auth/oauth', {
    method: 'POST',
    body: {
      provider: 'google',
      email: 'ola.nordmann@gmail.com',
      name: 'Ola Nordmann',
      transferScore: 300
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.email, 'ola.nordmann@gmail.com');
  assert.strictEqual(res.data.user.name, 'Ola Nordmann');
  assert(res.data.user.id.startsWith('google_'));
  assert.strictEqual(res.data.profile.score, 300);
  assert.strictEqual(res.data.isNewUser, true);
});

// -----------------------------------------------------------------------------
// T9: Repeat Google OAuth connects to EXACT same account & preserves XP (No random emails!)
// -----------------------------------------------------------------------------
await test('T9: Repeat Google OAuth connects to EXACT same account & preserves XP', async () => {
  // Simulate user earning 100 XP during gameplay
  const existingProf = mockProfiles.get('google_ola_nordmann');
  if (existingProf) existingProf.score += 100;

  // Now user signs in with Google again later
  const res = await request('/api/auth/oauth', {
    method: 'POST',
    body: {
      provider: 'google',
      email: 'ola.nordmann@gmail.com',
      name: 'Ola Nordmann'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.email, 'ola.nordmann@gmail.com');
  assert.strictEqual(res.data.user.name, 'Ola Nordmann');
  assert.strictEqual(res.data.user.id, 'google_ola_nordmann');
  assert.strictEqual(res.data.isNewUser, false);
  assert.strictEqual(res.data.profile.score, 400, 'Score must be preserved at 400 XP!');
});

// -----------------------------------------------------------------------------
// T10: Dedicated Apple OAuth endpoint with real email
// -----------------------------------------------------------------------------
await test('T10: Dedicated Apple OAuth endpoint with real email', async () => {
  const res = await request('/api/auth/oauth', {
    method: 'POST',
    body: {
      provider: 'apple',
      email: 'kari.nordmann@icloud.com',
      name: 'Kari Nordmann',
      transferScore: 50
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert.strictEqual(res.data.user.email, 'kari.nordmann@icloud.com');
  assert.strictEqual(res.data.user.name, 'Kari Nordmann');
  assert.strictEqual(res.data.user.id, 'apple_kari_nordmann');
  assert.strictEqual(res.data.profile.score, 50);
});

// -----------------------------------------------------------------------------
// T11: Reject OAuth with invalid or missing email (HTTP 400)
// -----------------------------------------------------------------------------
await test('T11: Reject OAuth with invalid or missing email (HTTP 400)', async () => {
  const res1 = await request('/api/auth/oauth', {
    method: 'POST',
    body: { provider: 'google', email: 'not_an_email' }
  });
  assert.strictEqual(res1.status, 400);

  const res2 = await request('/api/auth/oauth', {
    method: 'POST',
    body: { provider: 'invalid_provider', email: 'valid@example.com' }
  });
  assert.strictEqual(res2.status, 400);
});

// -----------------------------------------------------------------------------
// T12: Social friend search finds user by their real email
// -----------------------------------------------------------------------------
await test('T12: Social friend search finds user by their real email', async () => {
  const res = await request('/api/social/friends/request', {
    method: 'POST',
    userId: 'host',
    body: {
      query: 'ola.nordmann@gmail.com'
    }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.success, true);
  assert(res.data.message.includes('transmitted') || res.data.message.includes('sent'));
});

server.close();

console.log('\n================================================================================');
console.log(`  SUMMARY: ${passed} passed, ${failed} failed`);
console.log('================================================================================\n');

if (failed > 0) {
  process.exit(1);
}
