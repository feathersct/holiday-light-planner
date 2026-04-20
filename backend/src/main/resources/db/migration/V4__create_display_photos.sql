CREATE TABLE display_photos (
    id         BIGSERIAL PRIMARY KEY,
    display_id BIGINT       NOT NULL REFERENCES displays(id),
    user_id    BIGINT       NOT NULL REFERENCES users(id),
    url        VARCHAR(500) NOT NULL,
    is_primary BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_display_photos_primary
    ON display_photos (display_id)
    WHERE is_primary = TRUE;
