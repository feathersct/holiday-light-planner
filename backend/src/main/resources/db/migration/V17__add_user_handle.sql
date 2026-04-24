ALTER TABLE users ADD COLUMN handle VARCHAR(30);

WITH slugs AS (
  SELECT id,
    substr(lower(regexp_replace(
      regexp_replace(coalesce(display_name, name, 'user'), '[^a-zA-Z0-9]+', '-', 'g'),
      '^-+|-+$', '', 'g'
    )), 1, 20) AS raw_slug
  FROM users
),
safe_slugs AS (
  SELECT id,
    CASE WHEN length(raw_slug) < 3 THEN 'user-' || id::text ELSE raw_slug END AS slug
  FROM slugs
),
ranked AS (
  SELECT id, slug,
    row_number() OVER (PARTITION BY slug ORDER BY id) AS rn
  FROM safe_slugs
)
UPDATE users u
SET handle = CASE WHEN r.rn = 1 THEN r.slug ELSE r.slug || '-' || r.rn::text END
FROM ranked r
WHERE u.id = r.id;

CREATE UNIQUE INDEX users_handle_unique ON users(handle) WHERE handle IS NOT NULL;
