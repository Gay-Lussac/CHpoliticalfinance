import { test } from 'node:test';
import assert from 'node:assert/strict';
import { institutionCode } from '../src/mandates.js';

test('institutions are grouped into fixed codes', () => {
  const cases = {
    'Conseil national': 'CN', 'Conseil national (-/-)': 'CN', 'Conseil des États (ab Mai 2025)': 'CE', 'Conseil fédéral': 'CF',
    'Tribunal fédéral': 'TF', 'Tribunal administratif fédéral': 'TAF', 'Tribunal pénal fédéral': 'TPF',
    'Tribunal fédéral des brevets': 'TFB', Bundeskanzler: 'CHA', Nationalrat: 'CN', Bundesgericht: 'TF',
    'Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter': 'OTHER', '': 'OTHER',
  };
  for (const [raw, code] of Object.entries(cases)) assert.equal(institutionCode(raw), code, raw);
});
