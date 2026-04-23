-- ============================================================
-- Migration 005: upsert_coverage_area RPC
-- Accepts a GeoJSON geometry string and inserts/updates a
-- coverage_area row. Needed because the JS client cannot
-- automatically coerce GeoJSON text → geography column.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_coverage_area(
  p_city_id  uuid,
  p_name     text,
  p_geojson  text   -- GeoJSON geometry as text, e.g. '{"type":"Polygon","coordinates":[...]}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO coverage_areas (city_id, name, boundary)
  VALUES (
    p_city_id,
    p_name,
    ST_GeomFromGeoJSON(p_geojson)::geography
  )
  ON CONFLICT (city_id, name) DO UPDATE
    SET boundary = EXCLUDED.boundary
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
