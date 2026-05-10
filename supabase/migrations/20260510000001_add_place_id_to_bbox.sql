-- Add google_place_id to restaurants_in_bbox so the client can fetch
-- fresh photos on demand without storing expirable photo_references.
DROP FUNCTION IF EXISTS restaurants_in_bbox(double precision, double precision, double precision, double precision);

CREATE OR REPLACE FUNCTION restaurants_in_bbox(
  sw_lat double precision,
  sw_lng double precision,
  ne_lat double precision,
  ne_lng double precision
)
RETURNS TABLE (
  id                     uuid,
  name                   text,
  lat                    double precision,
  lng                    double precision,
  walk_in_status         text,
  cuisine_type           text,
  confirmation_count     integer,
  confirmation_count_30d integer,
  last_confirmed_at      timestamptz,
  is_stale               boolean,
  hours                  jsonb,
  address                text,
  neighborhood_id        uuid,
  google_place_id        text,
  photo_url              text,
  tip_summary            text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    r.id,
    r.name,
    r.lat,
    r.lng,
    r.walk_in_status::text,
    r.cuisine_type,
    r.confirmation_count,
    (
      SELECT COUNT(*)::integer
      FROM confirmations c
      WHERE c.restaurant_id = r.id
        AND c.created_at >= now() - interval '30 days'
    ) AS confirmation_count_30d,
    r.last_confirmed_at,
    r.is_stale,
    r.hours,
    r.address,
    r.neighborhood_id,
    r.google_place_id,
    r.photo_url,
    r.tip_summary
  FROM restaurants r
  WHERE
    ST_Within(
      r.location::geometry,
      ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    )
    AND r.walk_in_status != 'reservations_required'
$$;
