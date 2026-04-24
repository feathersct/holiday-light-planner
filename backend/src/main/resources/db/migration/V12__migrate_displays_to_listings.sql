-- Rename table
ALTER TABLE displays RENAME TO listings;

-- Rename primary index
ALTER INDEX idx_displays_location RENAME TO idx_listings_location;
ALTER INDEX idx_displays_active RENAME TO idx_listings_active;

-- Update foreign keys in child tables to point at renamed table
ALTER TABLE display_photos
  DROP CONSTRAINT IF EXISTS display_photos_display_id_fkey,
  ADD CONSTRAINT display_photos_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE upvotes
  DROP CONSTRAINT IF EXISTS upvotes_display_id_fkey,
  ADD CONSTRAINT upvotes_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE display_tags
  DROP CONSTRAINT IF EXISTS display_tags_display_id_fkey,
  ADD CONSTRAINT display_tags_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_display_id_fkey,
  ADD CONSTRAINT reports_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES listings(id) ON DELETE CASCADE;

-- Make display_type nullable (non-lights categories won't have it)
ALTER TABLE listings ALTER COLUMN display_type DROP NOT NULL;

-- Add new columns
ALTER TABLE listings
  ADD COLUMN category       VARCHAR(30),
  ADD COLUMN start_datetime TIMESTAMP,
  ADD COLUMN end_datetime   TIMESTAMP,
  ADD COLUMN cuisine_type   VARCHAR(100),
  ADD COLUMN organizer      VARCHAR(255),
  ADD COLUMN website_url    VARCHAR(500),
  ADD COLUMN price_info     VARCHAR(255);

-- Backfill existing rows
UPDATE listings SET
  category       = 'CHRISTMAS_LIGHTS',
  start_datetime = '2024-12-01 00:00:00',
  end_datetime   = '2025-01-05 23:59:59'
WHERE category IS NULL;

-- Now make required columns non-nullable
ALTER TABLE listings
  ALTER COLUMN category       SET NOT NULL,
  ALTER COLUMN start_datetime SET NOT NULL,
  ALTER COLUMN end_datetime   SET NOT NULL;

-- New indexes for common filters
CREATE INDEX idx_listings_category     ON listings (category);
CREATE INDEX idx_listings_end_datetime ON listings (end_datetime);
