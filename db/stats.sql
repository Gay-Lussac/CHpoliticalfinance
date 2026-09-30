-- Visit statistics, in a SEPARATE database (<prefix>_chpf_stats) so that the website's DB user can write here
-- while staying read-only on the main database. Privacy: aggregated daily counts only: no cookies, no IP
-- addresses, no user agents are ever stored (docs/05 › Visit statistics). Idempotent.

CREATE TABLE IF NOT EXISTS page_view_daily (
  day           DATE         NOT NULL,
  page          VARCHAR(40)  NOT NULL,   -- normalised route: 'home', 'vote/30', 'donor/1', 'explore', 'other'
  lang          CHAR(2)      NOT NULL,
  referrer      VARCHAR(100) NOT NULL DEFAULT '',   -- external site host on entry ('' = direct/internal)
  views         INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (day, page, lang, referrer)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS visitor_daily (
  day           DATE         NOT NULL PRIMARY KEY,
  visitors      INT UNSIGNED NOT NULL DEFAULT 0    -- distinct daily fingerprints (kept in memory only, never stored)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
