-- Election campaigns for a party or a group of parties without named candidates ("dans toute la Suisse"):
-- the parties they name. Set by the pipeline; used by the actor Orientation tab.
CREATE TABLE IF NOT EXISTS campaign_target_party (
  campaign_id   BIGINT UNSIGNED NOT NULL,
  party_id      SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (campaign_id, party_id),
  FOREIGN KEY (campaign_id) REFERENCES campaign(id) ON DELETE CASCADE,
  FOREIGN KEY (party_id) REFERENCES party(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
