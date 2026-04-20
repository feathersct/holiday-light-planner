CREATE TABLE tags (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

INSERT INTO tags (name) VALUES
    ('animated'),
    ('music-synced'),
    ('walk-through'),
    ('drive-by'),
    ('inflatables'),
    ('lights-only');
