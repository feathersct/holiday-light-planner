CREATE TABLE display_tags (
    display_id BIGINT NOT NULL REFERENCES displays(id),
    tag_id     BIGINT NOT NULL REFERENCES tags(id),
    PRIMARY KEY (display_id, tag_id)
);
