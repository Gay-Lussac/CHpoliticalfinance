-- Ballots, results and recommendations from Swissvotes (Année politique suisse, Univ. Bern; CC BY 4.0).
-- One EFK vote financing can cover several ballot questions (initiative + direct counter-proposal + tie-break).
-- Idempotent. Replaces the unused, always-empty party_recommendation table.

DROP TABLE IF EXISTS party_recommendation;

CREATE TABLE IF NOT EXISTS ballot (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  anr           VARCHAR(10) NOT NULL UNIQUE,     -- Swissvotes/BFS vote number, e.g. '665', '682.2'
  financing_id  BIGINT UNSIGNED NOT NULL,        -- matched EFK vote
  vote_date     DATE NOT NULL,
  role          ENUM('main','counter_proposal','tie_break') NOT NULL,
  legal_form    ENUM('mandatory_referendum','optional_referendum','popular_initiative',
                     'counter_proposal','tie_break') NOT NULL,
  yes_share     DECIMAL(5,2) NULL,               -- % yes (people); NULL until the vote has taken place
  turnout       DECIMAL(5,2) NULL,
  outcome       ENUM('accepted','rejected','counter_proposal_preferred','initiative_preferred','moot') NULL,
  cantons_yes   DECIMAL(3,1) NULL,               -- cantons in favour (half-cantons count 0.5)
  last_seen_run BIGINT UNSIGNED NULL,
  KEY ix_financing (financing_id),
  FOREIGN KEY (financing_id) REFERENCES financing(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recommender (
  id            SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code          VARCHAR(20) NOT NULL UNIQUE,     -- Swissvotes column suffix: 'sps' for p-sps
  kind          ENUM('party','organisation') NOT NULL,
  party_id      SMALLINT UNSIGNED NULL,
  sort_order    SMALLINT NOT NULL DEFAULT 100,
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ballot_recommendation (
  ballot_id      BIGINT UNSIGNED NOT NULL,
  recommender_id SMALLINT UNSIGNED NOT NULL,
  recommendation ENUM('yes','no','none','blank','free','prefer_counter_proposal','prefer_initiative') NOT NULL,
  PRIMARY KEY (ballot_id, recommender_id),
  FOREIGN KEY (ballot_id) REFERENCES ballot(id) ON DELETE CASCADE,
  FOREIGN KEY (recommender_id) REFERENCES recommender(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
