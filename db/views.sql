-- CHpoliticalfinance – semantic layer (read by the API). Idempotent: re-apply after any change.

-- ---------------------------------------------------------------- semantic layer (what the API reads)

CREATE OR REPLACE VIEW v_flow AS
SELECT a.id              AS allowance_id,
       f.id              AS financing_id,
       f.kind            AS financing_kind,
       f.event_date,
       f.year,
       d.phase,
       -- latest = the version to use when phases are mixed: final/annual, or budget when no final exists yet
       (d.phase <> 'budget' OR NOT EXISTS (SELECT 1 FROM declaration d2
          WHERE d2.efk_campaign_id = d.efk_campaign_id AND d2.phase = 'final')) AS is_latest,
       c.id              AS campaign_id,
       c.stance,
       ac.id             AS actor_id,
       COALESCE(e.canton, c.canton, ac.canton) AS canton,
       COALESCE(c.party_id, ap.party_id) AS party_id,
       dn.id             AS donor_id,
       dn.donor_type,
       a.nature,
       a.is_anonymous,
       a.is_foreign,
       a.granted_on,
       a.value_chf
FROM allowance a
JOIN declaration d        ON d.id = a.declaration_id
JOIN financing f          ON f.id = d.financing_id
JOIN actor ac             ON ac.id = d.actor_id
LEFT JOIN campaign c      ON c.id = d.campaign_id
LEFT JOIN election e      ON e.financing_id = f.id
LEFT JOIN actor_party ap  ON ap.actor_id = ac.id
LEFT JOIN donor_alias al  ON al.id = a.donor_alias_id
LEFT JOIN donor dn        ON dn.id = al.donor_id;

CREATE OR REPLACE VIEW v_campaign_totals AS
SELECT f.id AS financing_id, f.kind AS financing_kind, f.event_date, f.year,
       d.phase, c.id AS campaign_id, c.stance, d.actor_id,
       COALESCE(e.canton, c.canton, ac.canton) AS canton,
       COALESCE(c.party_id, ap.party_id) AS party_id,
       t.total, t.monetary_allowances, t.non_monetary_allowances, t.events, t.sales,
       t.equity, t.membership_fees, t.mandate_contributions
FROM declaration_totals t
JOIN declaration d        ON d.id = t.declaration_id
JOIN financing f          ON f.id = d.financing_id
JOIN actor ac             ON ac.id = d.actor_id
LEFT JOIN campaign c      ON c.id = d.campaign_id
LEFT JOIN election e      ON e.financing_id = f.id
LEFT JOIN actor_party ap  ON ap.actor_id = d.actor_id;

CREATE OR REPLACE VIEW v_financing_summary AS
SELECT financing_id, financing_kind, event_date, year, phase, stance,
       COUNT(DISTINCT actor_id) AS n_actors,
       SUM(total)               AS total_chf
FROM v_campaign_totals
GROUP BY financing_id, financing_kind, event_date, year, phase, stance;

CREATE OR REPLACE VIEW v_party_year AS
SELECT f.id AS financing_id, f.year, d.actor_id, ap.party_id,
       t.total, t.monetary_allowances, t.non_monetary_allowances, t.events, t.sales,
       t.membership_fees, t.mandate_contributions
FROM declaration_totals t
JOIN declaration d        ON d.id = t.declaration_id
JOIN financing f          ON f.id = d.financing_id AND f.kind = 'party_year'
LEFT JOIN actor_party ap  ON ap.actor_id = d.actor_id;

CREATE OR REPLACE VIEW v_mandate AS
SELECT m.id AS mandate_id, f.id AS financing_id, f.year, d.actor_id, ap.party_id,
       m.last_name, m.first_name, m.institution, m.amount_chf
FROM mandate_contribution m
JOIN declaration d        ON d.id = m.declaration_id
JOIN financing f          ON f.id = d.financing_id
LEFT JOIN actor_party ap  ON ap.actor_id = d.actor_id;
