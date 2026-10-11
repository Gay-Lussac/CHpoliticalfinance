import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StatsAuth, base32Encode, totp } from '../src/auth.js';

// RFC 6238 test vector: secret "12345678901234567890" (SHA1), T = 59 s → 94287082 (8 digits)
test('TOTP matches the RFC 6238 test vector', () => {
  const secret = Buffer.from('12345678901234567890');
  assert.equal(totp(secret, Math.floor(59 / 30), 8), '94287082');
  assert.equal(totp(secret, Math.floor(1111111109 / 30), 8), '07081804');
});

function setup(t0 = 1_800_000_000_000) {
  let now = t0;
  const raw = Buffer.from('a-test-secret-of-20b');
  const auth = new StatsAuth({ key: 'k3y', totpSecret: base32Encode(raw), now: () => now });
  const code = () => totp(raw, Math.floor(now / 30_000));
  return { auth, code, advance: (ms) => { now += ms; } };
}

test('needs both the key and a valid code; a code cannot be reused', () => {
  const { auth, code, advance } = setup();
  assert.equal(auth.login('wrong', code()).status, 401);
  assert.equal(auth.login('k3y', '000000').status, 401);
  const c = code();
  const ok = auth.login('k3y', c);
  assert.ok(ok.token && auth.verify(ok.token));
  assert.equal(auth.login('k3y', c).status, 401, 'replayed code rejected');
  advance(30_000);
  assert.ok(auth.login('k3y', code()).token, 'next code works');
});

test('session tokens expire and cannot be forged', () => {
  const { auth, code, advance } = setup();
  const { token } = auth.login('k3y', code());
  assert.ok(auth.verify(token));
  assert.ok(!auth.verify(`${Date.now() + 9e9}.forged`));
  advance(8 * 3600_000 + 1000);
  assert.ok(!auth.verify(token), 'expired');
});

test('locks out after 10 failures in 15 minutes', () => {
  const { auth, code, advance } = setup();
  for (let i = 0; i < 10; i++) auth.login('k3y', '123456');
  assert.equal(auth.login('k3y', code()).status, 429, 'even a correct login is refused while locked');
  advance(15 * 60_000 + 1000);
  assert.ok(auth.login('k3y', code()).token, 'unlocked after 15 minutes');
});

test('refuses to work without a TOTP secret (fail closed)', () => {
  const auth = new StatsAuth({ key: 'k3y', totpSecret: '' });
  assert.equal(auth.login('k3y', '123456').status, 503);
});
