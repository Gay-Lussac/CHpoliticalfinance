-- CHpoliticalfinance – schema DRAFT (MariaDB 10.6+ / MySQL 8)
-- Design notes: docs/02-database.md. Not final: validate against phase-1 spike results.

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- provenance

CREATE TABLE fetch_run (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  started_at    DATETIME NOT NULL,
  finished_at   DATETIME NULL,
  status        ENUM('running','ok','failed','partial') NOT NULL DEFAULT 'running',
  trigger_kind  ENUM('cron','manual','backfill') NOT NULL,
  notes         TEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE raw_payload (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fetch_run_id  BIGINT UNSIGNED NOT NULL,
  url           VARCHAR(500) NOT NULL,
  lang          CHAR(2) NULL,
  checksum      CHAR(64) NOT NULL,          -- meta.data_checksum_sha256 or sha256(body)
  content_type  VARCHAR(100) NOT NULL,
  archive_path  VARCHAR(500) NOT NULL,      -- file in the raw archive (body not stored in DB)
  fetched_at    DATETIME NOT NULL,
  UNIQUE KEY uq_url_checksum (url, checksum),
  FOREIGN KEY (fetch_run_id) REFERENCES fetch_run(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- i18n

CREATE TABLE i18n_label (
  entity      VARCHAR(40)     NOT NULL,     -- 'financing','actor','campaign','party',...
  entity_id   BIGINT UNSIGNED NOT NULL,
  field       VARCHAR(40)     NOT NULL,     -- 'title','name','short',...
  lang        CHAR(2)         NOT NULL,     -- fr,de,it,en
  text        TEXT            NOT NULL,
  is_official BOOLEAN         NOT NULL DEFAULT TRUE,  -- FALSE = our translation (EN)
  PRIMARY KEY (entity, entity_id, field, lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- core

CREATE TABLE financing (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kind          ENUM('vote','election','party_year') NOT NULL,
  efk_id        INT UNSIGNED NOT NULL,       -- campaign_financing.id / party_financing.id
  event_date    DATE NULL,                   -- vote/election day; NULL for party_year
  year          SMALLINT NOT NULL,
  name          VARCHAR(500) NOT NULL,       -- source-language fallback
  has_budget    BOOLEAN NOT NULL DEFAULT FALSE,
  has_final     BOOLEAN NOT NULL DEFAULT FALSE,
  first_seen_run BIGINT UNSIGNED NULL,
  last_seen_run  BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_kind_efk (kind, efk_id),
  KEY ix_date (event_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vote_object (
  financing_id  BIGINT UNSIGNED PRIMARY KEY,
  bfs_vote_no   INT UNSIGNED NULL UNIQUE,    -- e.g. 6650; mapped, may be NULL until matched
  object_type   ENUM('popular_initiative','mandatory_referendum','optional_referendum','counter_proposal','other') NULL,
  yes_share     DECIMAL(5,2) NULL,           -- enrichment (phase 7)
  turnout       DECIMAL(5,2) NULL,
  accepted      BOOLEAN NULL,
  FOREIGN KEY (financing_id) REFERENCES financing(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE election (
  financing_id  BIGINT UNSIGNED PRIMARY KEY,
  council       ENUM('CN','CE') NOT NULL,    -- Conseil national / Conseil des États
  canton        CHAR(2) NULL,                -- NULL = general election all cantons
  is_by_election BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (financing_id) REFERENCES financing(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE party (
  id            SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE, -- 'SVP','SP','FDP','MITTE','GRUENE','GLP','EVP','EDU',...
  color         CHAR(7) NULL,                -- '#RRGGBB'
  sort_order    SMALLINT NOT NULL DEFAULT 100
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE actor (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  efk_id        INT UNSIGNED NOT NULL UNIQUE,
  name          VARCHAR(300) NOT NULL,
  city          VARCHAR(120) NULL,
  canton        CHAR(2) NULL,
  actor_type    ENUM('legal_entity','natural_person','other') NOT NULL,
  first_seen_run BIGINT UNSIGNED NULL,
  last_seen_run  BIGINT UNSIGNED NULL,
  KEY ix_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE actor_party (
  actor_id      BIGINT UNSIGNED PRIMARY KEY,
  party_id      SMALLINT UNSIGNED NOT NULL,
  level         ENUM('national','cantonal','communal','youth','other') NOT NULL DEFAULT 'other',
  source        ENUM('efk','heuristic','manual') NOT NULL,
  FOREIGN KEY (actor_id) REFERENCES actor(id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  efk_id        INT UNSIGNED NOT NULL UNIQUE,
  financing_id  BIGINT UNSIGNED NOT NULL,
  actor_id      BIGINT UNSIGNED NOT NULL,
  stance        ENUM('for','against','candidates','none') NOT NULL,
  name          VARCHAR(1000) NOT NULL,      -- raw label ("Adoption…", candidate list…)
  first_seen_run BIGINT UNSIGNED NULL,
  last_seen_run  BIGINT UNSIGNED NULL,
  KEY ix_fin_stance (financing_id, stance),
  FOREIGN KEY (financing_id) REFERENCES financing(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actor(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE candidate (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  efk_person_id INT UNSIGNED NULL UNIQUE,    -- people/{id} if it turns out to be usable
  last_name     VARCHAR(120) NOT NULL,
  first_name    VARCHAR(120) NOT NULL,
  canton        CHAR(2) NULL,
  party_id      SMALLINT UNSIGNED NULL,
  political_group VARCHAR(200) NULL,         -- "Groupement politique candidat"
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE campaign_candidate (
  campaign_id   BIGINT UNSIGNED NOT NULL,
  candidate_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (campaign_id, candidate_id),
  FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidate(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE declaration (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  campaign_id   BIGINT UNSIGNED NULL,        -- NULL for party_year declarations
  financing_id  BIGINT UNSIGNED NOT NULL,    -- denormalised, makes party_year uniform
  actor_id      BIGINT UNSIGNED NOT NULL,
  efk_form_id   INT UNSIGNED NOT NULL,       -- form TYPE id (109, 111, 112, …)
  efk_campaign_id INT UNSIGNED NOT NULL,     -- (efk_campaign_id, efk_form_id) = upstream identity
  efk_declaration_id INT UNSIGNED NULL,      -- "ID déclaration" from xlsx when present
  phase         ENUM('budget','final','annual') NOT NULL,
  kind          ENUM('totals','allowances','allowances_incl_foreign','mandates') NOT NULL,
  source_checksum CHAR(64) NULL,
  first_seen_run BIGINT UNSIGNED NULL,
  last_seen_run  BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_upstream (efk_campaign_id, efk_form_id),
  KEY ix_fin_phase (financing_id, phase),
  FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
  FOREIGN KEY (financing_id) REFERENCES financing(id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES actor(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE declaration_totals (
  declaration_id          BIGINT UNSIGNED PRIMARY KEY,
  total                   DECIMAL(14,2) NOT NULL,
  monetary_allowances     DECIMAL(14,2) NOT NULL DEFAULT 0,
  non_monetary_allowances DECIMAL(14,2) NOT NULL DEFAULT 0,
  events                  DECIMAL(14,2) NOT NULL DEFAULT 0,
  sales                   DECIMAL(14,2) NOT NULL DEFAULT 0,
  equity                  DECIMAL(14,2) NULL,          -- campaigns only
  membership_fees         DECIMAL(14,2) NULL,          -- party_year only
  mandate_contributions   DECIMAL(14,2) NULL,          -- party_year only
  FOREIGN KEY (declaration_id) REFERENCES declaration(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donor (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  donor_type    ENUM('natural','legal','anonymous') NOT NULL,
  display_name  VARCHAR(300) NOT NULL,       -- "Blocher Christoph" / "economiesuisse"
  city          VARCHAR(120) NULL,
  lives_abroad  BOOLEAN NULL,
  reviewed      BOOLEAN NOT NULL DEFAULT FALSE,  -- manually confirmed identity
  KEY ix_name (display_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE donor_alias (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  match_key     VARCHAR(400) NOT NULL UNIQUE, -- normalised: type|name|first_name|city (lowercase, no accents)
  raw_name      VARCHAR(300) NOT NULL,
  raw_first_name VARCHAR(120) NULL,
  raw_city      VARCHAR(120) NULL,
  donor_id      BIGINT UNSIGNED NOT NULL,
  link_source   ENUM('auto','manual') NOT NULL DEFAULT 'auto',
  FOREIGN KEY (donor_id) REFERENCES donor(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE allowance (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  efk_id        INT UNSIGNED NULL UNIQUE,    -- allowance.id / "ID libéralité" (NULL if not recoverable)
  declaration_id BIGINT UNSIGNED NOT NULL,
  donor_alias_id BIGINT UNSIGNED NULL,       -- NULL when anonymous
  nature        ENUM('monetary','non_monetary') NOT NULL,
  service_type  VARCHAR(200) NULL,           -- non-monetary: "Prestation de services", …
  description   VARCHAR(1000) NULL,
  value_chf     DECIMAL(14,2) NOT NULL,
  granted_on    DATE NULL,
  is_anonymous  BOOLEAN NOT NULL DEFAULT FALSE,
  is_foreign    BOOLEAN NOT NULL DEFAULT FALSE,
  row_hash      CHAR(64) NOT NULL,           -- fallback identity when efk_id is NULL
  first_seen_run BIGINT UNSIGNED NULL,
  last_seen_run  BIGINT UNSIGNED NULL,
  UNIQUE KEY uq_decl_hash (declaration_id, row_hash),
  KEY ix_granted (granted_on),
  FOREIGN KEY (declaration_id) REFERENCES declaration(id) ON DELETE CASCADE,
  FOREIGN KEY (donor_alias_id) REFERENCES donor_alias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mandate_contribution (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  declaration_id BIGINT UNSIGNED NOT NULL,
  last_name     VARCHAR(120) NOT NULL,
  first_name    VARCHAR(120) NULL,
  institution   VARCHAR(300) NULL,           -- "Mandat (autorité)"
  amount_chf    DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (declaration_id) REFERENCES declaration(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE party_recommendation (
  financing_id  BIGINT UNSIGNED NOT NULL,    -- vote_object financing
  party_id      SMALLINT UNSIGNED NOT NULL,
  recommendation ENUM('yes','no','free','blank','none') NOT NULL,
  source        VARCHAR(100) NOT NULL DEFAULT 'BFS je-f-17.03.01.04',
  PRIMARY KEY (financing_id, party_id),
  FOREIGN KEY (financing_id) REFERENCES vote_object(financing_id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- semantic layer (what the API reads)

CREATE VIEW v_flow AS
SELECT a.id              AS allowance_id,
       f.id              AS financing_id,
       f.kind            AS financing_kind,
       f.event_date,
       f.year,
       d.phase,
       c.id              AS campaign_id,
       c.stance,
       ac.id             AS actor_id,
       ac.canton         AS actor_canton,
       ap.party_id       AS actor_party_id,
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
LEFT JOIN actor_party ap  ON ap.actor_id = ac.id
LEFT JOIN donor_alias al  ON al.id = a.donor_alias_id
LEFT JOIN donor dn        ON dn.id = al.donor_id;

CREATE VIEW v_campaign_totals AS
SELECT f.id AS financing_id, f.kind AS financing_kind, f.event_date, f.year,
       d.phase, c.id AS campaign_id, c.stance, d.actor_id, ap.party_id AS actor_party_id,
       t.total, t.monetary_allowances, t.non_monetary_allowances, t.events, t.sales,
       t.equity, t.membership_fees, t.mandate_contributions
FROM declaration_totals t
JOIN declaration d        ON d.id = t.declaration_id
JOIN financing f          ON f.id = d.financing_id
LEFT JOIN campaign c      ON c.id = d.campaign_id
LEFT JOIN actor_party ap  ON ap.actor_id = d.actor_id;

CREATE VIEW v_financing_summary AS
SELECT financing_id, financing_kind, event_date, year, phase, stance,
       COUNT(DISTINCT actor_id) AS n_actors,
       SUM(total)               AS total_chf
FROM v_campaign_totals
GROUP BY financing_id, financing_kind, event_date, year, phase, stance;
