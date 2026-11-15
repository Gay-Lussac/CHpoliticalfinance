-- National Council final votes on the objects put to the people (Parliamentary Services, ws.parlament.ch).
-- `inverted`: Parliament voted on its recommendation decree, so its "yes" means "no" to the object (popular
-- initiatives); `for_object` in the API is computed from it. Reloaded in full by the pipeline.
CREATE TABLE IF NOT EXISTS parl_vote (
  id                INT UNSIGNED PRIMARY KEY,            -- Parliament vote id
  ballot_id         BIGINT UNSIGNED NOT NULL,
  council           CHAR(2) NOT NULL DEFAULT 'NR',
  business          VARCHAR(20) NOT NULL,                -- e.g. 24.080
  bill_title        VARCHAR(500) NULL,
  voted_at          DATETIME NULL,
  inverted          BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at        DATE NULL,
  KEY ix_ballot (ballot_id),
  FOREIGN KEY (ballot_id) REFERENCES ballot(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS parl_voting (
  vote_id           INT UNSIGNED NOT NULL,
  person_number     INT UNSIGNED NOT NULL,               -- Parliament person number (= Lobbywatch parlament_biografie_id)
  first_name        VARCHAR(120) NOT NULL,
  last_name         VARCHAR(120) NOT NULL,
  canton            CHAR(2) NULL,
  group_code        VARCHAR(10) NULL,                    -- parliamentary group: V, S, RL, M-E, G, GL…
  decision          ENUM('yes','no','abstain','absent','excused','president') NOT NULL,
  PRIMARY KEY (vote_id, person_number),
  KEY ix_person (person_number),
  FOREIGN KEY (vote_id) REFERENCES parl_vote(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link Lobbywatch members to Parliament's person number (and so to their votes).
ALTER TABLE lw_parliamentarian ADD COLUMN IF NOT EXISTS parl_person_number INT UNSIGNED NULL AFTER id;
