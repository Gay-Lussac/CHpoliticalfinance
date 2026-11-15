import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { areaChain, buildIndex, parsePolicyAreas, queryWords, search, wordScore } from '../src/search.js';

test('words match exactly, by prefix, inside compounds and with small typos', () => {
  assert.equal(wordScore('rente', 'rente'), 3);
  assert.equal(wordScore('gastro', 'gastrosuisse'), 2);
  assert.ok(wordScore('rente', 'renteninitiative') > 0);
  assert.ok(wordScore('initiative', 'renteninitiative') > 0);
  assert.ok(wordScore('economiesuise', 'economiesuisse') > 0);
  assert.ok(wordScore('retraites', 'retraite') > 0);
  assert.ok(wordScore('gosi', 'gossi') > 0);
  assert.equal(wordScore('ab', 'xab'), 0);
  assert.equal(wordScore('climat', 'clinique'), 0);
});

test('stop words are ignored unless the query has nothing else', () => {
  assert.deepEqual(queryWords('initiative pour la retraite'), ['initiative', 'retraite']);
  assert.deepEqual(queryWords('la'), ['la']);
});

const index = buildIndex([
  { group: 'financings', id: 1, label: { fr: 'Initiative 13e rente AVS', de: '13. AHV-Rente' }, date: '2024-03-03',
    fields: [{ text: 'Mieux vivre à la retraite (initiative pour une 13e rente AVS)', weight: 1 },
      { text: 'Assurance-vieillesse | AHV | retraite | pension', weight: 0.8, area: '10.21' }] },
  { group: 'financings', id: 2, label: { fr: 'Loi climat' }, date: '2023-06-18',
    fields: [{ text: 'Loi sur le climat et l’innovation', weight: 1 }] },
  { group: 'actors', id: 7, label: 'GastroSuisse', fields: [{ text: 'GastroSuisse', weight: 1 }] },
]);

test('every word must match somewhere, in any order', () => {
  assert.deepEqual(search(index, 'rente 13', 'fr').financings.map((x) => x.id), [1]);
  assert.deepEqual(search(index, '13e rente', 'fr').financings.map((x) => x.id), [1]);
  assert.equal(search(index, 'rente climat', 'fr').financings, undefined);
});

test('policy areas find votes in any language and say why', () => {
  const r = search(index, 'Pension', 'de', 8, (code, lang) => `${code}/${lang}`);
  assert.deepEqual(r.financings, [{ id: 1, label: '13. AHV-Rente', via: '10.21/de' }]);
  assert.equal(search(index, 'gastro suisse', 'fr').actors[0].label, 'GastroSuisse');
});

test('policy area file parses and every code has its four names; chains go to broader areas', () => {
  const areas = parsePolicyAreas(readFileSync(new URL('../../config/policy_areas.yaml', import.meta.url), 'utf8'));
  assert.ok(Object.keys(areas).length > 150);
  for (const [code, a] of Object.entries(areas)) for (const l of ['de', 'fr', 'it', 'en']) assert.ok(a[l], `${code} ${l}`);
  assert.deepEqual(areaChain('10.21'), ['10.21', '10.2', '10']);
  assert.deepEqual(areaChain('9.3'), ['9.3', '9']);
  assert.deepEqual(areaChain('3'), ['3']);
});
