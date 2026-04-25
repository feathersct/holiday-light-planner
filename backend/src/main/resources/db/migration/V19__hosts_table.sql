CREATE TABLE hosts (
    id          BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id),
    handle      VARCHAR(30) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url  VARCHAR(500),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX hosts_handle_unique ON hosts(handle);
