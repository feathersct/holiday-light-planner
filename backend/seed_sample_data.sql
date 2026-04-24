-- Sample data for Tri Cities, TN
-- Run once against the target database

-- Seed user
INSERT INTO users (provider, provider_id, email, name, role)
VALUES ('seed', 'seed-001', 'seed@holidaylightplanner.com', 'HLP Seed Account', 'USER')
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Displays
INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'The Winters Family Spectacular',
    'Over 50,000 lights covering the entire yard with a full music-synchronized show. Tune your radio to 99.3 FM!',
    '412 Sunset Drive', 'Johnson City', 'TN', '37604',
    ST_SetSRID(ST_MakePoint(-82.3621, 36.3198), 4326),
    'Nightly 5:30pm–11pm, show runs every 30 min', 'DRIVE_BY', 47, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Christmas Lane on Cherokee',
    'The whole street participates — three blocks of coordinated lights. Best viewed by slowly driving through.',
    '218 Cherokee Road', 'Johnson City', 'TN', '37601',
    ST_SetSRID(ST_MakePoint(-82.3489, 36.3142), 4326),
    'Dusk to 10pm nightly', 'DRIVE_BY', 31, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Maple Street Winter Wonderland',
    'Walk-through display with a lit path through the yard, animated reindeer, and a talking Santa.',
    '834 Maple Street', 'Johnson City', 'TN', '37604',
    ST_SetSRID(ST_MakePoint(-82.3703, 36.3267), 4326),
    'Fri–Sun 5pm–9pm, weekdays 5pm–8pm', 'WALK_THROUGH', 22, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Henderson''s Holiday Extravaganza',
    'A massive display with over 30 inflatables and thousands of LED lights. The kids absolutely love this one.',
    '1105 Ravine Road', 'Kingsport', 'TN', '37660',
    ST_SetSRID(ST_MakePoint(-82.5512, 36.5423), 4326),
    'Every night 5pm–10pm through Dec 31', 'DRIVE_BY', 58, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Ridgefield Music Light Show',
    'Fully synchronized to Christmas music broadcast on 104.7 FM. New songs added every weekend.',
    '72 Ridgefield Lane', 'Kingsport', 'TN', '37663',
    ST_SetSRID(ST_MakePoint(-82.5687, 36.5501), 4326),
    'Nightly 6pm–10pm, tune to FM 104.7', 'DRIVE_BY', 74, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Dobyns Avenue Drive-Through',
    'Classic display with white lights outlining every roofline and tree. Simple but stunning.',
    '340 Dobyns Avenue', 'Kingsport', 'TN', '37660',
    ST_SetSRID(ST_MakePoint(-82.5441, 36.5378), 4326),
    'Dusk to midnight every night', 'DRIVE_BY', 19, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Anderson Street Walk-Through',
    'A beloved neighborhood tradition for 15 years. Walk the quarter-mile loop and get hot cocoa at the end!',
    '209 Anderson Street', 'Bristol', 'TN', '37620',
    ST_SetSRID(ST_MakePoint(-82.1923, 36.5887), 4326),
    'Fri–Sun 5pm–9pm', 'WALK_THROUGH', 63, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'The Reeves Christmas House',
    'Every square foot of this property is covered. Roof, trees, bushes, driveway — all lit up. A Bristol landmark.',
    '517 Volunteer Parkway', 'Bristol', 'TN', '37620',
    ST_SetSRID(ST_MakePoint(-82.1876, 36.5934), 4326),
    'Every night 5pm–11pm', 'BOTH', 41, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Covered Bridge Christmas',
    'Display set up near the historic covered bridge. Beautiful reflections on the river at night.',
    'Covered Bridge Road', 'Elizabethton', 'TN', '37643',
    ST_SetSRID(ST_MakePoint(-82.2134, 36.3489), 4326),
    'Nightly 5pm–10pm', 'DRIVE_BY', 28, true
FROM users WHERE provider_id = 'seed-001';

INSERT INTO displays (user_id, title, description, address, city, state, postcode, location, best_time, display_type, upvote_count, is_active)
SELECT id, 'Sullivan County Light Show',
    'Huge farm property with lights across multiple acres. Drive the loop through animated scenes from Rudolph and Frosty.',
    '1892 Old Airport Road', 'Blountville', 'TN', '37617',
    ST_SetSRID(ST_MakePoint(-82.4123, 36.5312), 4326),
    'Weekends only, 5pm–10pm', 'DRIVE_BY', 35, true
FROM users WHERE provider_id = 'seed-001';

-- Tags
INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'The Winters Family Spectacular' AND t.name IN ('music-synced', 'lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Christmas Lane on Cherokee' AND t.name IN ('drive-by', 'lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Maple Street Winter Wonderland' AND t.name IN ('walk-through', 'animated');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Henderson''s Holiday Extravaganza' AND t.name IN ('inflatables', 'lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Ridgefield Music Light Show' AND t.name IN ('music-synced', 'lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Dobyns Avenue Drive-Through' AND t.name IN ('lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Anderson Street Walk-Through' AND t.name IN ('walk-through', 'animated');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'The Reeves Christmas House' AND t.name IN ('lights-only', 'inflatables');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Covered Bridge Christmas' AND t.name IN ('lights-only');

INSERT INTO display_tags (display_id, tag_id)
SELECT d.id, t.id FROM displays d, tags t
WHERE d.title = 'Sullivan County Light Show' AND t.name IN ('animated', 'drive-by');
