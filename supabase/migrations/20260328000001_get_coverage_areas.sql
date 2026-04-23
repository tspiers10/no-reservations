-- Returns active coverage areas with boundary as GeoJSON text.
-- Used by /api/coverage to render neighborhood outlines on the map.
CREATE OR REPLACE FUNCTION get_coverage_areas(p_city_id uuid DEFAULT NULL)
RETURNS TABLE (
  id        uuid,
  name      text,
  is_active boolean,
  boundary_geojson text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    id,
    name,
    is_active,
    ST_AsGeoJSON(boundary)::text AS boundary_geojson
  FROM coverage_areas
  WHERE is_active = true
    AND (p_city_id IS NULL OR city_id = p_city_id);
$$;
