import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildQuery, QueryError } from '../src/query.js';

const config = JSON.parse(readFileSync(new URL('../../config/datasets.json', import.meta.url)));

test('aggregate query uses whitelisted identifiers and bound values', () => {
  const q = buildQuery(config, {
    dataset: 'flow', group_by: 'donor_id,stance', measure: 'sum:value_chf',
    'filter[financing_id]': '5,6', 'filter[granted_on][gte]': '2025-01-01', limit: '10',
  });
  assert.match(q.sql, /^SELECT `donor_id`, `stance`, SUM\(value_chf\) AS `sum_value_chf` FROM `v_flow` WHERE/);
  assert.deepEqual(q.args, [5, 6, '2025-01-01']);
  assert.match(q.sql, /ORDER BY `sum_value_chf` DESC LIMIT 10/);
});

test('rejects unknown fields, measures and bad values', () => {
  assert.throws(() => buildQuery(config, { dataset: 'flow', group_by: 'password' }), QueryError);
  assert.throws(() => buildQuery(config, { dataset: 'flow', group_by: 'stance', measure: 'sum:password' }), QueryError);
  assert.throws(() => buildQuery(config, { dataset: 'flow', 'filter[phase]': "final' OR 1=1" }), QueryError);
  assert.throws(() => buildQuery(config, { dataset: 'flow', 'filter[financing_id]': '1;DROP' }), QueryError);
  assert.throws(() => buildQuery(config, { dataset: 'users' }), QueryError);
});

test('limit is capped', () => {
  assert.equal(buildQuery(config, { dataset: 'flow', limit: '999999' }).limit, 5000);
});

test('fixed_filter from config is always applied (privacy guard on alignment)', () => {
  const q = buildQuery(config, { dataset: 'alignment', group_by: 'recommender_id', measure: 'share:aligned',
    'filter[donor_id]': '1' });
  assert.match(q.sql, /WHERE \(donor_type = 'legal'\) AND `donor_id` IN \(\?\)/);
  assert.throws(() => buildQuery(config, { dataset: 'alignment', 'filter[donor_type]': 'natural' }), QueryError);
});
