// Generates BOTH secrets for the two-factor stats login and writes them to a private file in your home folder
// (permissions 600). Nothing secret is printed, so it is safe to run in any terminal.
// Run: node api/scripts/new-stats-secrets.mjs
// Then: copy the values into your authenticator app / password manager / the Node.js run command,
// and delete the file.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { base32Encode } from '../src/auth.js';

const secret = base32Encode(randomBytes(20));
const key = randomBytes(24).toString('hex');
const file = join(homedir(), `polimoney-stats-secrets-${new Date().toISOString().slice(0, 10)}.txt`);

writeFileSync(file, `polimoney.ch – stats login secrets (created ${new Date().toISOString()})
Keep in your password manager, then DELETE this file.

1) Authenticator app → add account → "enter a setup key":
   account name: polimoney stats
   setup key:    ${secret}
   (or paste this link into apps that accept it)
   otpauth://totp/polimoney.ch%3Astats?secret=${secret}&issuer=polimoney.ch&algorithm=SHA1&digits=6&period=30

2) Infomaniak Manager → Node.js site → Run command: add before "node api/src/server.js":
   STATS_TOKEN='${key}' STATS_TOTP_SECRET=${secret}

3) Login on https://polimoney.ch/fr/stats:
   access key = ${key}
   code       = the 6 digits shown in the authenticator app
`, { mode: 0o600 });

console.log(`Secrets written to: ${file}`);
console.log('Open it with:  open -e "' + file + '"   – then delete it when done.');
