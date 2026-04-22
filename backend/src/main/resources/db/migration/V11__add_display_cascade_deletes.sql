-- Drop existing FK constraints and re-add with ON DELETE CASCADE

ALTER TABLE upvotes
  DROP CONSTRAINT upvotes_display_id_fkey,
  ADD CONSTRAINT upvotes_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;

ALTER TABLE reports
  DROP CONSTRAINT reports_display_id_fkey,
  ADD CONSTRAINT reports_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;

ALTER TABLE display_photos
  DROP CONSTRAINT display_photos_display_id_fkey,
  ADD CONSTRAINT display_photos_display_id_fkey
    FOREIGN KEY (display_id) REFERENCES displays(id) ON DELETE CASCADE;
