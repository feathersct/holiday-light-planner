CREATE TABLE displays (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT       NOT NULL REFERENCES users(id),
    title        VARCHAR(255) NOT NULL,
    description  TEXT,
    address      VARCHAR(500),
    city         VARCHAR(100),
    state        VARCHAR(100),
    postcode     VARCHAR(20),
    location     GEOGRAPHY(POINT, 4326) NOT NULL,
    best_time    VARCHAR(255),
    display_type VARCHAR(20)  NOT NULL DEFAULT 'DRIVE_BY',
    upvote_count INT          NOT NULL DEFAULT 0,
    photo_count  INT          NOT NULL DEFAULT 0,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_displays_location ON displays USING GIST (location);
CREATE INDEX idx_displays_active ON displays (is_active);
