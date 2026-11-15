-- A sync that found nothing new records its run as 'unchanged' without touching the data. The API's data version
-- only counts 'ok' and 'partial' runs, so the site's cache survives quiet nights.
ALTER TABLE fetch_run MODIFY status ENUM('running','ok','failed','partial','unchanged') NOT NULL DEFAULT 'running';
