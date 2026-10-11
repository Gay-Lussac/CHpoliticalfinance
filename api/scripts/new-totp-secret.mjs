// Generates a secret for the two-factor stats login. Run: node api/scripts/new-totp-secret.mjs
// Add the secret to your authenticator app (manual entry, or paste the otpauth link), then set it as
// STATS_TOTP_SECRET in the environment (local .env / Node.js run command). Never commit it.
import { randomBytes } from 'node:crypto';
import { base32Encode } from '../src/auth.js';

const secret = base32Encode(randomBytes(20));
const label = encodeURIComponent(`polimoney.ch:stats`);
console.log(`STATS_TOTP_SECRET=${secret}`);
console.log(`otpauth://totp/${label}?secret=${secret}&issuer=polimoney.ch&algorithm=SHA1&digits=6&period=30`);
