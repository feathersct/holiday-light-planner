-- Create default hosts for users who have listings without a host entity
INSERT INTO hosts (owner_user_id, handle, display_name, is_default)
SELECT
    u.id,
    LOWER(REGEXP_REPLACE(COALESCE(u.display_name, u.name), '[^a-zA-Z0-9]', '', 'g')) || u.id::text,
    COALESCE(u.display_name, u.name),
    TRUE
FROM users u
WHERE EXISTS (
    SELECT 1 FROM listings l WHERE l.user_id = u.id AND l.host_id IS NULL
)
AND NOT EXISTS (
    SELECT 1 FROM hosts h WHERE h.owner_user_id = u.id AND h.is_default = TRUE
);

-- Assign all host_id=null listings to the user's default host
UPDATE listings l
SET host_id = h.id
FROM hosts h
WHERE h.owner_user_id = l.user_id
  AND h.is_default = TRUE
  AND l.host_id IS NULL;
