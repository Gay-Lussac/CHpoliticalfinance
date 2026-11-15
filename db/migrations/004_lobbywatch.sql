-- Lobbywatch (https://lobbywatch.ch, CC BY-SA 4.0): current members of the Federal Assembly, their declared ties
-- (board seats, jobs, memberships) and the organisations concerned. Reloaded in full from the weekly public export
-- by the pipeline; only current data (historical Lobbywatch data is not openly licensed and is not imported).

CREATE TABLE IF NOT EXISTS lw_parliamentarian (
  id                INT UNSIGNED PRIMARY KEY,            -- Lobbywatch parlamentarier.id
  last_name         VARCHAR(120) NOT NULL,
  first_name        VARCHAR(120) NOT NULL,
  canton            CHAR(2) NULL,
  council           ENUM('NR','SR') NULL,                -- Nationalrat / Ständerat
  party_label       VARCHAR(40) NULL,                    -- Lobbywatch party abbreviation
  party_id          SMALLINT UNSIGNED NULL,
  in_council_since  DATE NULL,
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Matched EFK election candidates (the EFK sometimes lists one person under two spellings: both are linked).
CREATE TABLE IF NOT EXISTS lw_candidate (
  candidate_id      BIGINT UNSIGNED PRIMARY KEY,
  parliamentarian_id INT UNSIGNED NOT NULL,
  KEY ix_parl (parliamentarian_id),
  FOREIGN KEY (parliamentarian_id) REFERENCES lw_parliamentarian(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lw_organisation (
  id                INT UNSIGNED PRIMARY KEY,            -- Lobbywatch organisation.id
  name_de           VARCHAR(500) NOT NULL,
  name_fr           VARCHAR(500) NULL,
  name_it           VARCHAR(500) NULL,
  city              VARCHAR(200) NULL,
  legal_form        VARCHAR(60) NULL,
  lobby_group_de    VARCHAR(200) NULL,                   -- Lobbywatch "Interessengruppe"
  lobby_group_fr    VARCHAR(200) NULL,
  actor_id          BIGINT UNSIGNED NULL,                -- matched EFK actor (committee, association, party…)
  donor_id          BIGINT UNSIGNED NULL,                -- matched EFK donor (legal entities)
  match_source      ENUM('auto','manual') NULL,
  KEY ix_actor (actor_id),
  KEY ix_donor (donor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lw_tie (
  id                INT UNSIGNED PRIMARY KEY,            -- Lobbywatch interessenbindung.id
  parliamentarian_id INT UNSIGNED NOT NULL,
  organisation_id   INT UNSIGNED NOT NULL,
  kind              VARCHAR(30) NOT NULL,                -- mitglied, vorstand, beirat, taetig, geschaeftsfuehrend, gesellschafter, finanziell
  role              VARCHAR(40) NULL,                    -- praesident, vizepraesident, mitglied…
  description_de    VARCHAR(500) NULL,
  description_fr    VARCHAR(500) NULL,
  must_declare      BOOLEAN NOT NULL DEFAULT TRUE,       -- deklarationspflichtig
  main_job          BOOLEAN NOT NULL DEFAULT FALSE,      -- hauptberuflich
  since             DATE NULL,
  pay_year          SMALLINT NULL,                       -- latest year with a remuneration entry
  pay               INT NULL,                            -- -1 paying member, 0 unpaid, 1 paid (amount not disclosed), >1 CHF per year
  KEY ix_parl (parliamentarian_id),
  KEY ix_org (organisation_id),
  FOREIGN KEY (parliamentarian_id) REFERENCES lw_parliamentarian(id) ON DELETE CASCADE,
  FOREIGN KEY (organisation_id) REFERENCES lw_organisation(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lw_meta (
  k                 VARCHAR(40) PRIMARY KEY,
  v                 VARCHAR(200) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
