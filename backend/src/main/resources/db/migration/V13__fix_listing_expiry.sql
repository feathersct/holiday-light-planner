-- Make end_datetime nullable so listings without a natural end date stay visible
ALTER TABLE listings ALTER COLUMN end_datetime DROP NOT NULL;

-- Extend expired Christmas Lights listings to the next season
UPDATE listings
SET end_datetime = '2026-01-05 23:59:59',
    start_datetime = '2025-12-01 00:00:00'
WHERE category = 'CHRISTMAS_LIGHTS'
  AND end_datetime < NOW();
