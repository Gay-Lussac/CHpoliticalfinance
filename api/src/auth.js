// Two-factor login for the private stats page: static key (factor 1) + TOTP code from an authenticator app
// (factor 2, RFC 6238), then a short-lived signed session token. No secret is ever stored in the repository:
// STATS_TOKEN and STATS_TOTP_SECRET come from the environment only.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Decode(s) {
  const clean = String(s).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = '';
  for (const c of clean) {
    const v = B32.indexOf(c);
    if (v < 0) throw new Error('invalid base32');
    bits += v.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

export function base32Encode(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return out;
}

/** RFC 6238 TOTP (HMAC-SHA1, 30 s steps). */
export function totp(secret, counter, digits = 6) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', secret).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  const code = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(code % 10 ** digits).padStart(digits, '0');
}

const safeEq = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export class StatsAuth {
  constructor({ key, totpSecret, sessionHours = 8, now = () => Date.now() }) {
    this.key = key || '';
    this.secret = totpSecret ? base32Decode(totpSecret) : null;
    this.sessionMs = sessionHours * 3600_000;
    this.now = now;
    this.signing = randomBytes(32);          // per process: a restart logs everyone out
    this.lastCounter = -1;                   // replay protection: a code works once
    this.failures = [];                      // timestamps of recent failures (global lockout)
  }

  get configured() { return Boolean(this.key && this.secret); }

  lockedUntil() {
    const cutoff = this.now() - 15 * 60_000;
    this.failures = this.failures.filter((t) => t > cutoff);
    return this.failures.length >= 10 ? this.failures[0] + 15 * 60_000 : 0;
  }

  /** Returns { token, expires } or { error, status }. */
  login(key, code) {
    if (!this.configured) return { error: 'two-factor login not configured', status: 503 };
    if (this.lockedUntil() > this.now()) return { error: 'too many failed attempts, try again later', status: 429 };
    const step = Math.floor(this.now() / 30_000);
    let matched = -1;
    for (const c of [step - 1, step, step + 1]) {          // ±30 s clock drift
      if (c > this.lastCounter && /^\d{6}$/.test(String(code)) && safeEq(totp(this.secret, c), code)) { matched = c; break; }
    }
    if (!safeEq(key ?? '', this.key) || matched < 0) {
      this.failures.push(this.now());
      return { error: 'wrong key or code', status: 401 };
    }
    this.lastCounter = matched;                            // consume the code only after BOTH factors passed
    const expires = this.now() + this.sessionMs;
    const payload = String(expires);
    const sig = createHmac('sha256', this.signing).update(payload).digest('base64url');
    return { token: `${payload}.${sig}`, expires };
  }

  verify(token) {
    const [payload, sig] = String(token ?? '').split('.');
    if (!payload || !sig) return false;
    const expected = createHmac('sha256', this.signing).update(payload).digest('base64url');
    return safeEq(sig, expected) && Number(payload) > this.now();
  }
}
