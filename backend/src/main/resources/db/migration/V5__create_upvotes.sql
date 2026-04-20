CREATE TABLE upvotes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT    NOT NULL REFERENCES users(id),
    display_id BIGINT    NOT NULL REFERENCES displays(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, display_id)
);
