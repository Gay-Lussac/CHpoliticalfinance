import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSitemap } from '../src/sitemap.js';

test('sitemap lists each page in every language with hreflang alternates', () => {
  const xml = buildSitemap('https://polimoney.ch/', ['', 'vote/12']);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  for (const l of ['fr', 'de', 'it', 'en']) {
    assert.match(xml, new RegExp(`<loc>https://polimoney.ch/${l}/vote/12</loc>`));
    assert.match(xml, new RegExp(`<loc>https://polimoney.ch/${l}/</loc>`));
  }
  assert.equal((xml.match(/<url>/g) ?? []).length, 8);
  assert.match(xml, /hreflang="x-default" href="https:\/\/polimoney.ch\/fr\/vote\/12"/);
  assert.doesNotMatch(xml, /donor|stats/);
});

test('sitemap escapes XML special characters', () => {
  assert.match(buildSitemap('https://x.ch', ['a&b']), /a&amp;b/);
});
