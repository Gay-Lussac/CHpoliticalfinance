-- Federal vote results by canton (Federal Statistical Office, voting-day open data). Reloaded by the pipeline.
CREATE TABLE IF NOT EXISTS ballot_canton (
  ballot_id         BIGINT UNSIGNED NOT NULL,
  canton            CHAR(2) NOT NULL,
  yes_share         DECIMAL(5,2) NOT NULL,
  yes               INT UNSIGNED NOT NULL,
  no                INT UNSIGNED NOT NULL,
  turnout           DECIMAL(5,2) NULL,
  provisional       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (ballot_id, canton),
  FOREIGN KEY (ballot_id) REFERENCES ballot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Final votes of both chambers as counted by Swissvotes, for the proposal (Council of States: totals only for now).
ALTER TABLE ballot ADD COLUMN IF NOT EXISTS nr_yes SMALLINT UNSIGNED NULL AFTER policy_areas;
ALTER TABLE ballot ADD COLUMN IF NOT EXISTS nr_no SMALLINT UNSIGNED NULL AFTER nr_yes;
ALTER TABLE ballot ADD COLUMN IF NOT EXISTS sr_yes SMALLINT UNSIGNED NULL AFTER nr_no;
ALTER TABLE ballot ADD COLUMN IF NOT EXISTS sr_no SMALLINT UNSIGNED NULL AFTER sr_yes;
