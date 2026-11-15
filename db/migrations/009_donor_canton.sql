-- Where named donations come from (homepage map): each donor's canton, matched by the pipeline from the town in the
-- declarations to the official municipality list (BFS); 'abroad' for donors abroad; NULL when it cannot be placed.
ALTER TABLE donor ADD COLUMN IF NOT EXISTS canton VARCHAR(6) NULL AFTER country;
-- Registered voters per canton (latest federal vote, BFS), for amounts per voter.
CREATE TABLE IF NOT EXISTS canton_info (
  canton            CHAR(2) PRIMARY KEY,
  voters            INT UNSIGNED NOT NULL,
  as_of             DATE NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registered voters per canton for each ballot (BFS), for the representatives' agreement score (share of a canton's
-- registered voters who voted the same way as its member).
ALTER TABLE ballot_canton ADD COLUMN IF NOT EXISTS eligible INT UNSIGNED NULL AFTER no;
