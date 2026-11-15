-- Swissvotes policy areas of each ballot (most specific code of d1/d2/d3, e.g. "10.21,6.14"); labels in
-- config/policy_areas.yaml. Used by the site search. Set by the pipeline.
ALTER TABLE ballot ADD COLUMN IF NOT EXISTS policy_areas VARCHAR(100) NULL AFTER cantons_yes;
