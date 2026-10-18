import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SizedCache } from '../src/cache.js';

test('evicts oldest entries to stay under the byte budget', () => {
  const c = new SizedCache({ maxBytes: 1000, maxEntryBytes: 600 });
  for (let i = 0; i < 20; i++) c.set(`k${i}`, 'x'.repeat(200));
  assert.ok(c.bytes <= 1000, `bytes=${c.bytes}`);
  assert.ok(!c.has('k0') && c.has('k19'));
});

test('never caches an oversized value', () => {
  const c = new SizedCache({ maxBytes: 10_000, maxEntryBytes: 100 });
  assert.equal(c.set('big', 'y'.repeat(500)), false);
  assert.equal(c.has('big'), false);
});
