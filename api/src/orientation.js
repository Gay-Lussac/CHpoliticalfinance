// Political orientation of an actor (committee, association, party section…), from what it did rather than who paid it:
// - votes: the side it campaigned for, compared with each party's / federation's Yes/No recommendation (Swissvotes);
// - elections: the parties of the candidates it backed. A campaign declares one amount for all the candidates it names,
//   so the amount per candidate is estimated by splitting it evenly between them.

/**
 * stances: [{ financing_id, stance: 'for'|'against', title, event_date, outcome, ballot_id }]
 * recs:    [{ ballot_id, recommender_id, code, kind, label, color, recommendation: 'yes'|'no' }]
 */
export function summarizeVotes(stances, recs) {
  // An actor with campaigns on both sides of the same vote has no position on it.
  const sides = new Map();
  for (const s of stances) {
    const prev = sides.get(s.financing_id);
    if (prev === undefined) sides.set(s.financing_id, s);
    else if (prev && prev.stance !== s.stance) sides.set(s.financing_id, null);
  }
  const votes = [...sides.values()].filter(Boolean).sort((a, b) => String(b.event_date).localeCompare(String(a.event_date)));
  const byBallot = new Map(votes.map((v) => [v.ballot_id, v]));

  const recommenders = new Map();
  for (const r of recs) {
    const v = byBallot.get(r.ballot_id);
    if (!v || (r.recommendation !== 'yes' && r.recommendation !== 'no')) continue;
    const entry = recommenders.get(r.recommender_id)
      ?? { id: r.recommender_id, code: r.code, kind: r.kind, label: r.label, color: r.color, agree: 0, disagree: 0 };
    if ((v.stance === 'for') === (r.recommendation === 'yes')) entry.agree += 1; else entry.disagree += 1;
    recommenders.set(r.recommender_id, entry);
  }
  const list = [...recommenders.values()].map((e) => ({ ...e, n: e.agree + e.disagree, share: e.agree / (e.agree + e.disagree) }))
    .sort((a, b) => b.share - a.share || b.n - a.n || a.label.localeCompare(b.label));

  const won = (v) => (v.outcome === 'accepted' ? v.stance === 'for' : v.outcome === 'rejected' ? v.stance === 'against' : null);
  return {
    votes: votes.map((v) => ({ financing_id: v.financing_id, title: v.title, event_date: v.event_date, stance: v.stance,
      outcome: v.outcome ?? null, won: won(v) })),
    recommenders: list,
  };
}

/**
 * rows: one per (campaign, candidate): [{ campaign_id, financing_id, title, event_date, total, candidate_id,
 *        party_code, party_color, party_label }]
 */
export function summarizeElections(rows) {
  const perCampaign = new Map();
  for (const r of rows) perCampaign.set(r.campaign_id, (perCampaign.get(r.campaign_id) ?? 0) + 1);

  const parties = new Map();
  const campaigns = new Map();
  for (const r of rows) {
    const n = perCampaign.get(r.campaign_id);
    const share = r.total == null ? 0 : Number(r.total) / n;
    const key = r.party_code ?? r.party_label ?? '';
    const p = parties.get(key) ?? { code: r.party_code, label: r.party_label, color: r.party_color, candidates: new Set(), chf: 0 };
    p.candidates.add(r.candidate_id);
    p.chf += share;
    parties.set(key, p);
    if (!campaigns.has(r.campaign_id)) {
      campaigns.set(r.campaign_id, { campaign_id: r.campaign_id, financing_id: r.financing_id, title: r.title,
        event_date: r.event_date, total: r.total == null ? null : Number(r.total), n_candidates: n });
    }
  }
  const total = [...parties.values()].reduce((s, p) => s + p.chf, 0);
  const nCand = new Set(rows.map((r) => r.candidate_id)).size;
  return {
    n_candidates: nCand,
    total_chf: total,
    parties: [...parties.values()].map((p) => ({ code: p.code, label: p.label, color: p.color, n_candidates: p.candidates.size,
      est_chf: Math.round(p.chf), share: total ? p.chf / total : p.candidates.size / nCand }))
      .sort((a, b) => b.share - a.share || b.n_candidates - a.n_candidates),
    campaigns: [...campaigns.values()].sort((a, b) => String(b.event_date).localeCompare(String(a.event_date))),
  };
}
