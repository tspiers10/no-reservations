-- Add Manhattan as a second active city.
-- Center point sits between the four launch neighborhoods
-- (East Village, West Village, Lower East Side, Chinatown).
-- The map page uses slug='brooklyn' for its default viewport,
-- so this does not affect the existing map load.

INSERT INTO cities (name, slug, center_lat, center_lng, is_active)
VALUES ('Manhattan', 'manhattan', 40.722, -73.992, true)
ON CONFLICT (slug) DO NOTHING;
