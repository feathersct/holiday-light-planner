-- Upvote count trigger
CREATE OR REPLACE FUNCTION update_upvote_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE displays SET upvote_count = upvote_count + 1 WHERE id = NEW.display_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE displays SET upvote_count = upvote_count - 1 WHERE id = OLD.display_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_upvote_count
    AFTER INSERT OR DELETE ON upvotes
    FOR EACH ROW EXECUTE FUNCTION update_upvote_count();

-- Photo count trigger
CREATE OR REPLACE FUNCTION update_photo_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE displays SET photo_count = photo_count + 1 WHERE id = NEW.display_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE displays SET photo_count = photo_count - 1 WHERE id = OLD.display_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_photo_count
    AFTER INSERT OR DELETE ON display_photos
    FOR EACH ROW EXECUTE FUNCTION update_photo_count();
