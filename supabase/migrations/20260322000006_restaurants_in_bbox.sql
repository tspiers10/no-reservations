-- ============================================================
-- Migration 006: restaurants_in_bbox RPC
-- Returns restaurants within a lat/lng bounding box.
-- Called by GET /api/restaurants?bbox=...
-- ============================================================

CREATE OR REPLACE FUNCTION restaurants_in_bbox(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision
)
RETURNS TABLE (
  id                uuid,
  name              text,
  lat               double precision,
  lng               double precision,
  walk_in_status    text,
  cuisine_type      text,
  confirmation_count integer,
  last_confirmed_at  timestamptz,
  is_stale          boolean,
  hours             jsonb,
  address           text,
  neighborhood_id   uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    id,
    name,
    lat,
    lng,
    walk_in_status::text,
    cuisine_type,
    confirmation_count,
    last_confirmed_at,
    is_stale,
    hours,
    address,
    neighborhood_id
  FROM restaurants
  WHERE
    ST_Within(
      location::geometry,
      ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    )
  ORDER BY name;
$$;
