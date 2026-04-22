-- Drop existing FK constraints and re-add with ON DELETE CASCADE

ALTER TABLE upvotes
  DROP CONSTRAINT IF EXISTS upvotes_display_id_fkey,
  ADD CONSTRAINT upvotes_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;

ALTER TABLE reports
  DROP CONSTRAINT IF EXISTS reports_display_id_fkey,
  ADD CONSTRAINT reports_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;

ALTER TABLE display_photos
  DROP CONSTRAINT IF EXISTS display_photos_display_id_fkey,
  ADD CONSTRAINT display_photos_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;

ALTER TABLE display_tags
  DROP CONSTRAINT IF EXISTS display_tags_display_id_fkey,
  ADD CONSTRAINT display_tags_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;
