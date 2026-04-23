-- ============================================================
-- Migration 003: Row Level Security Policies
-- No Reservations
--
-- Auth model:
--   • Map browsing: always public (anon role can read)
--   • Confirmations: auth required (authenticated role can insert own rows)
--   • Users: read own profile only
-- ============================================================

-- ── Enable RLS on all tables ────────────────────────────────
ALTER TABLE cities          ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_areas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE confirmations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE users           ENABLE ROW LEVEL SECURITY;

-- ── cities: public read ─────────────────────────────────────
CREATE POLICY "cities_public_read"
  ON cities FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── coverage_areas: public read ─────────────────────────────
CREATE POLICY "coverage_areas_public_read"
  ON coverage_areas FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── restaurants: public read ────────────────────────────────
CREATE POLICY "restaurants_public_read"
  ON restaurants FOR SELECT
  TO anon, authenticated
  USING (true);

-- No direct INSERT/UPDATE/DELETE from the browser.
-- All writes go through /api/ routes using the service_role key.

-- ── confirmations: authenticated users insert own rows ───────
CREATE POLICY "confirmations_insert_own"
  ON confirmations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can read their own confirmations (for profile page)
CREATE POLICY "confirmations_select_own"
  ON confirmations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ── users: read and update own profile ──────────────────────
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Service role (used by API routes) bypasses RLS entirely —
-- this is Supabase's default behavior and requires no additional policy.
