-- ============================================================
-- Migration 001: PostGIS + Initial Schema
-- No Reservations
--
-- Tables: cities, coverage_areas, restaurants, confirmations, users
-- PostGIS is enabled here so geography columns work in the same
-- migration. Migration 002 is a safe re-enable (idempotent).
-- ============================================================

-- Enable PostGIS first — required for geography column types below
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- ── cities ─────────────────────────────────────────────────
-- Drives the default map viewport per city.
-- Adding a new city = inserting a row, no code change needed.
CREATE TABLE cities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,   -- e.g. 'brooklyn', 'nyc'
  center_lat double precision NOT NULL,
  center_lng double precision NOT NULL,
  is_active  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Brooklyn is the only active city at launch
INSERT INTO cities (name, slug, center_lat, center_lng, is_active)
VALUES ('Brooklyn', 'brooklyn', 40.6782, -73.9442, true);

-- ── coverage_areas ──────────────────────────────────────────
-- PostGIS polygon boundaries per neighborhood.
-- Used for: empty-state detection, map overlay, and restaurant
-- neighborhood assignment. Polygons seeded via seed-coverage-areas.ts.
CREATE TABLE coverage_areas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id    uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name       text NOT NULL,           -- e.g. 'Park Slope'
  boundary   geography(Geometry, 4326) NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coverage_areas_boundary_idx ON coverage_areas USING GIST (boundary);
CREATE INDEX coverage_areas_city_idx ON coverage_areas (city_id);

-- ── restaurants ─────────────────────────────────────────────
CREATE TYPE walk_in_status AS ENUM (
  'walk_in_only',          -- green pin
  'bar_seating',           -- yellow pin
  'large_parties_only',    -- orange pin — walk-in for 1–4
  'reservations_required'  -- grey pin — de-emphasized, hidden by default
);

CREATE TABLE restaurants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id          uuid NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  neighborhood_id  uuid REFERENCES coverage_areas(id) ON DELETE SET NULL,
  name             text NOT NULL,
  address          text NOT NULL,
  lat              double precision NOT NULL,
  lng              double precision NOT NULL,
  location         geography(Point, 4326) NOT NULL, -- indexed for spatial queries
  cuisine_type     text,
  google_place_id  text UNIQUE,
  -- Hours stored per day as JSONB: { monday: { open: "17:00", close: "23:00" } | null }
  hours            jsonb,
  walk_in_status   walk_in_status NOT NULL DEFAULT 'walk_in_only',
  confirmation_count integer NOT NULL DEFAULT 0,
  last_confirmed_at  timestamptz,
  -- is_stale is set by a nightly cron / application logic, not a trigger,
  -- to keep the DB simple. True when last_confirmed_at is >90 days ago or NULL.
  is_stale         boolean NOT NULL DEFAULT true,
  notes            text CHECK (char_length(notes) <= 140),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- GiST spatial index — essential for ST_DWithin and bbox queries at scale
CREATE INDEX restaurants_location_idx ON restaurants USING GIST (location);
CREATE INDEX restaurants_city_idx ON restaurants (city_id);
CREATE INDEX restaurants_neighborhood_idx ON restaurants (neighborhood_id);
CREATE INDEX restaurants_status_idx ON restaurants (walk_in_status);

-- Auto-update updated_at on any row change
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER restaurants_updated_at
  BEFORE UPDATE ON restaurants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── users ───────────────────────────────────────────────────
-- Mirrors Supabase auth.users. Created via trigger on first sign-in.
CREATE TABLE users (
  id               uuid PRIMARY KEY, -- = auth.users.id
  email            text NOT NULL,
  display_name     text,
  confirmation_count integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Auto-create a users row when a Supabase auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── confirmations ───────────────────────────────────────────
CREATE TABLE confirmations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id    uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  -- 'still_walk_in' = "Still walk-in ✓" tap (no status change)
  -- any walk_in_status value = "This changed ✗" with new categorization
  status_submitted text NOT NULL CHECK (
    status_submitted IN (
      'still_walk_in',
      'walk_in_only',
      'bar_seating',
      'large_parties_only',
      'reservations_required'
    )
  ),
  note             text CHECK (char_length(note) <= 140),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX confirmations_restaurant_idx ON confirmations (restaurant_id);
CREATE INDEX confirmations_user_idx ON confirmations (user_id);
CREATE INDEX confirmations_created_idx ON confirmations (created_at DESC);

-- After each confirmation, update the restaurant's counter and staleness flag
CREATE OR REPLACE FUNCTION handle_new_confirmation()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurants
  SET
    confirmation_count = confirmation_count + 1,
    last_confirmed_at  = NEW.created_at,
    is_stale           = false,
    -- If "This changed", update the walk_in_status
    walk_in_status = CASE
      WHEN NEW.status_submitted = 'still_walk_in' THEN walk_in_status
      ELSE NEW.status_submitted::walk_in_status
    END
  WHERE id = NEW.restaurant_id;

  -- Increment user's total confirmation count
  UPDATE users
  SET confirmation_count = confirmation_count + 1
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_confirmation_created
  AFTER INSERT ON confirmations
  FOR EACH ROW EXECUTE FUNCTION handle_new_confirmation();
