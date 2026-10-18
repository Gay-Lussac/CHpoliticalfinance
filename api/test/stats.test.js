import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBot, normalisePath, referrerHost, tokenOk } from '../src/stats.js';

test('paths are reduced to known routes; anything else becomes "other"', () => {
  assert.deepEqual(normalisePath('/fr/vote/30?phase=final'), { lang: 'fr', page: 'vote/30' });
  assert.deepEqual(normalisePath('/de/'), { lang: 'de', page: 'home' });
  assert.deepEqual(normalisePath('/en/explore?ds=flow&fin=12'), { lang: 'en', page: 'explore' });
  assert.deepEqual(normalisePath('/it/donor/abc'), { lang: 'it', page: 'other' });
  assert.deepEqual(normalisePath('/fr/wp-admin/../../etc/passwd'), { lang: 'fr', page: 'other' });
  assert.deepEqual(normalisePath('/xx/votes'), { lang: 'xx', page: 'votes' });
});

test('only external referrer hosts are kept, without path or query', () => {
  assert.equal(referrerHost('https://www.nzz.ch/schweiz/artikel?x=1', 'polimoney.ch'), 'nzz.ch');
  assert.equal(referrerHost('https://polimoney.ch/fr/votes', 'polimoney.ch'), '');
  assert.equal(referrerHost('https://www.polimoney.ch/', 'polimoney.ch:443'), '');
  assert.equal(referrerHost('', 'polimoney.ch'), '');
  assert.equal(referrerHost('not a url', 'polimoney.ch'), '');
});

test('bots and empty user agents are ignored', () => {
  assert.ok(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)'));
  assert.ok(isBot('curl/8.4.0'));
  assert.ok(isBot(undefined));
  assert.ok(!isBot('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Safari/605.1.15'));
});

test('stats key check', () => {
  assert.ok(tokenOk('abc123', 'abc123'));
  assert.ok(!tokenOk('abc124', 'abc123'));
  assert.ok(!tokenOk('abc123', undefined));
  assert.ok(!tokenOk('', ''));
});

test('page ids and referrer hosts are bounded', () => {
  assert.deepEqual(normalisePath('/fr/vote/1234567'), { lang: 'fr', page: 'other' });
  assert.equal(referrerHost('https://exa mple.com/', 'polimoney.ch'), '');
});

test('distinct rows per day are capped (table cannot explode)', async () => {
  const { Stats } = await import('../src/stats.js');
  const written = new Set();
  const pool = { query: async (sql, args) => { if (sql.includes('page_view_daily')) written.add(`${args[1]}|${args[2]}|${args[3]}`); return [[]]; } };
  const s = new Stats(pool, 'stats_db', { warn() {}, error() {} });
  s.maxKeysPerDay = 3;
  for (let i = 1; i <= 10; i++) {
    await s.record({ path: `/fr/vote/${i}`, ref: '', ip: `10.0.0.${i}`, ua: 'Mozilla/5.0 Safari', host: 'polimoney.ch' });
  }
  assert.equal(written.size, 4, '3 real pages + 1 folded "other" row');
  assert.ok(written.has('other|fr|'));
});
