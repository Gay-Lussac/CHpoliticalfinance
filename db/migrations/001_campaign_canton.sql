-- Campaign canton: majority canton of the supported candidates (elections). Set by the pipeline.
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS canton CHAR(2) NULL AFTER party_id;
