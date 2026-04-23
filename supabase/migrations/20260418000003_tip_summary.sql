-- Add AI-generated tip summary column to restaurants.
-- Populated server-side by summarize-tips.ts whenever a note is submitted
-- via a confirmation or a restaurant submission is approved.

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tip_summary text;

-- Drop first — Postgres won't allow changing a function's return type in-place.
DROP FUNCTION IF EXISTS restaurants_in_bbox(double precision, double precision, double precision, double precision);

-- Recreate restaurants_in_bbox with tip_summary, photo_url, and
-- confirmation_count_30d (computed dynamically from confirmations).
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
    r.photo_url,
    r.tip_summary
  FROM restaurants r
  WHERE
    ST_Within(
      r.location::geometry,
      ST_MakeEnvelope(sw_lng, sw_lat, ne_lng, ne_lat, 4326)
    )
  ORDER BY r.name;
$$;
