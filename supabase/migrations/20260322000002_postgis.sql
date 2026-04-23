-- ============================================================
-- Migration 002: Enable PostGIS
--
-- Must run BEFORE migration 001 on a fresh DB, or the geography
-- columns in 001 will fail. Supabase cloud projects have PostGIS
-- available but not always enabled by default.
--
-- On Supabase hosted: enable via Dashboard → Database → Extensions
-- or let this migration handle it.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- postgis_topology is managed by Supabase internally; no action needed here.
