CREATE TABLE users (
    id         BIGSERIAL PRIMARY KEY,
    provider   VARCHAR(20)  NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL,
    name       VARCHAR(255),
    avatar_url VARCHAR(500),
    role       VARCHAR(20)  NOT NULL DEFAULT 'USER',
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_id)
);
