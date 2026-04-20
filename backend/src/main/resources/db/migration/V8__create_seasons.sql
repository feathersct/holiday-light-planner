CREATE TABLE seasons (
    id         BIGSERIAL PRIMARY KEY,
    display_id BIGINT    NOT NULL REFERENCES displays(id),
    year       INT       NOT NULL,
    is_active  BOOLEAN   NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (display_id, year)
);
