CREATE OR REPLACE FUNCTION update_upvote_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE listings SET upvote_count = upvote_count + 1 WHERE id = NEW.display_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE listings SET upvote_count = upvote_count - 1 WHERE id = OLD.display_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_photo_count() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE listings SET photo_count = photo_count + 1 WHERE id = NEW.display_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE listings SET photo_count = photo_count - 1 WHERE id = OLD.display_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
