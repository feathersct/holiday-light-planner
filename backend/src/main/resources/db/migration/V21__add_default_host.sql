ALTER TABLE hosts ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX hosts_one_default_per_owner ON hosts(owner_user_id) WHERE is_default = TRUE;
