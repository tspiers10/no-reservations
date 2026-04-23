-- Returns true if the given lat/lng falls within any active coverage area.
-- Used by /api/suggestions to reject out-of-area restaurant submissions.
CREATE OR REPLACE FUNCTION is_within_coverage(p_lat float8, p_lng float8)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM coverage_areas
    WHERE is_active = true
    AND ST_Contains(
      boundary::geometry,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
  );
$$;
