-- ============================================================
-- Migration 004: RPC Helper Functions
-- ============================================================

-- find_neighborhood: returns the coverage_area ID that contains
-- the given lat/lng point within a specific city.
-- Used by the seed script and can be called from API routes.
CREATE OR REPLACE FUNCTION find_neighborhood(
  p_lat  double precision,
  p_lng  double precision,
  p_city_id uuid
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id
  FROM coverage_areas
  WHERE
    city_id = p_city_id
    AND is_active = true
    AND ST_Contains(
      boundary::geometry,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
  LIMIT 1;
$$;
