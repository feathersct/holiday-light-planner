CREATE TABLE reports (
    id         BIGSERIAL   PRIMARY KEY,
    display_id BIGINT      NOT NULL REFERENCES displays(id),
    user_id    BIGINT      NOT NULL REFERENCES users(id),
    reason     VARCHAR(50) NOT NULL,
    notes      TEXT,
    status     VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP   NOT NULL DEFAULT NOW()
);
