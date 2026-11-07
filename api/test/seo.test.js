import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notFoundMeta, pageMeta, parsePath, renderHead } from '../src/seo.js';

const TEMPLATE = '<html lang="fr"><head><!--seo--><title>x</title><!--/seo--><meta name="theme-color" /></head></html>';

test('parsePath accepts real pages and rejects everything else', () => {
  assert.deepEqual(parsePath('/de/vote/30'), { lang: 'de', page: 'vote', id: '30', bare: false });
  assert.equal(parsePath('/').page, '');
  assert.equal(parsePath('/votes?x=1').lang, 'fr');           // no language: browser picks one, canonical is /fr/
  assert.equal(parsePath('/en/').page, '');
  assert.equal(parsePath('/fr/stats').page, 'stats');
  for (const bad of ['/xyz', '/fr/blabla', '/fr/vote', '/fr/vote/abc', '/fr/votes/1', '/fr/vote/1/2', '/xx/votes', '/fr/donor']) {
    assert.equal(parsePath(bad), null, bad);
  }
});

test('detail pages get a specific title and description in their language', () => {
  const vote = { kind: 'vote', title: 'Biodiversité', event_date: '2024-09-22', allowances: { final: { total: 4200000 } } };
  const m = pageMeta({ lang: 'fr', page: 'vote', id: '30' }, vote);
  assert.match(m.title, /^Biodiversité \(22 septembre 2024\) · Argent politique suisse$/);
  assert.match(m.description, /CHF 4.200.000 de dons déclarés/);
  const a = pageMeta({ lang: 'de', page: 'actor', id: '9' }, { name: 'Komitee X', canton: 'BE', campaigns: 2 });
  assert.match(a.description, /^Komitee X \(BE\): .*2 Kampagnen/);
});

test('renderHead fills language, canonical, alternates and preview tags, escaping data', () => {
  const html = renderHead(TEMPLATE, { lang: 'it', path: 'vote/30', title: 'A "b" <c>', description: 'd & e' }, 'https://polimoney.ch');
  assert.match(html, /^<html lang="it">/);
  assert.match(html, /<title>A &quot;b&quot; &lt;c&gt;<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/polimoney.ch\/it\/vote\/30" \/>/);
  for (const l of ['fr', 'de', 'it', 'en', 'x-default']) assert.match(html, new RegExp(`hreflang="${l}"`));
  assert.match(html, /og:image" content="https:\/\/polimoney.ch\/og\/og-it.png"/);
  assert.match(html, /<meta name="theme-color" \/>/);              // tags outside the block are kept
  assert.doesNotMatch(html, /noindex/);
});

test('not-found and private pages are noindex without canonical', () => {
  const nf = renderHead(TEMPLATE, notFoundMeta('xx'), 'https://polimoney.ch');
  assert.match(nf, /<html lang="fr">/);
  assert.match(nf, /noindex/);
  assert.doesNotMatch(nf, /canonical/);
  const donor = renderHead(TEMPLATE, pageMeta({ lang: 'en', page: 'donor', id: '5' }), 'https://polimoney.ch');
  assert.match(donor, /noindex/);
  assert.doesNotMatch(donor, /canonical/);
});
