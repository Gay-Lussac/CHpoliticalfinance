import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeElections, summarizeVotes } from '../src/orientation.js';

test('vote agreement counts positions against Yes/No recommendations', () => {
  const stances = [
    { financing_id: 1, stance: 'for', ballot_id: 11, outcome: 'accepted', event_date: '2024-01-01', title: 'A' },
    { financing_id: 2, stance: 'against', ballot_id: 12, outcome: 'accepted', event_date: '2024-02-01', title: 'B' },
    { financing_id: 3, stance: 'for', ballot_id: 13, event_date: '2024-03-01', title: 'C' },
    { financing_id: 3, stance: 'against', ballot_id: 13, event_date: '2024-03-01', title: 'C' },   // both sides: ignored
  ];
  const rec = (ballot_id, recommender_id, recommendation) => ({ ballot_id, recommender_id, recommendation, code: `r${recommender_id}`, kind: 'party', label: `P${recommender_id}` });
  const r = summarizeVotes(stances, [rec(11, 1, 'yes'), rec(12, 1, 'no'), rec(11, 2, 'no'), rec(12, 2, 'no'), rec(13, 1, 'yes'), rec(11, 3, 'free')]);
  assert.deepEqual(r.votes.map((v) => [v.financing_id, v.won]), [[2, false], [1, true]]);
  assert.deepEqual(r.recommenders.map((x) => [x.label, x.agree, x.n]), [['P1', 2, 2], ['P2', 1, 2]]);
});

test('election money is split evenly between the candidates of each campaign', () => {
  const row = (campaign_id, total, candidate_id, party_code) => ({ campaign_id, financing_id: 9, total, candidate_id, party_code, party_label: party_code });
  const r = summarizeElections([row(1, 300, 'a', 'FDP'), row(1, 300, 'b', 'FDP'), row(1, 300, 'c', 'SVP'), row(2, 100, 'a', 'FDP')]);
  assert.equal(r.n_candidates, 3);
  assert.deepEqual(r.parties.map((p) => [p.code, p.n_candidates, p.est_chf]), [['FDP', 2, 300], ['SVP', 1, 100]]);
  assert.equal(r.parties[0].share, 0.75);
  assert.deepEqual(r.campaigns.map((c) => c.n_candidates), [3, 1]);
});
