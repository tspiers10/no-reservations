# No Reservations — CLAUDE.md

## Project Overview
No Reservations is a hyperlocal, community-powered walk-in restaurant map for Brooklyn.
MVP coverage: Park Slope, Boerum Hill, Fort Greene, Prospect Heights (~200–400 seed restaurants).
Platform: Desktop-first, mobile-ready web app. Future PWA path. Expansion roadmap: NYC → multi-city.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase PostgreSQL + PostGIS (spatial queries)
- **Auth:** Supabase Auth — magic link only (no passwords)
- **Map:** Google Maps JS API (@vis.gl/react-google-maps)
- **Email:** Resend (admin digest + magic link delivery)
- **Analytics:** PostHog
- **Hosting:** Vercel (frontend + API routes + cron) + Supabase (DB + auth)

## Key Files
- `supabase/migrations/` — All DB schema changes. Never edit prod DB directly; always use migrations.
- `src/app/api/` — API routes: `confirmations/`, `restaurants/`, `coverage/`, `digest/`
- `src/components/map/MapContainer.tsx` — Google Maps integration, pin rendering
- `src/components/restaurant/RestaurantCard.tsx` — Bottom sheet card on pin tap
- `src/components/restaurant/ConfirmationFlow.tsx` — Walk-in confirmation UI
- `src/lib/supabase/server.ts` — Server-side Supabase client (used in API routes)
- `src/lib/supabase/client.ts` — Browser Supabase client (singleton)
- `src/hooks/useRestaurants.ts` — Fetch + cache restaurants by map bounding box
- `scripts/seed-restaurants.ts` — One-time CSV → Supabase insert script

## Data Model

**cities:** id, name, slug (e.g. `brooklyn`), center_lat, center_lng, is_active
— drives default map viewport and city-level feature flags; never hardcode coordinates in app code

**coverage_areas:** id, city_id, name (e.g. "Park Slope"), boundary (geometry polygon), is_active
— PostGIS polygons used for empty-state detection (ST_Contains) and map overlay

**restaurants:** id, city_id, neighborhood_id (FK → coverage_areas), name, address, lat, lng, location (geometry Point), cuisine_type, google_place_id, hours (JSONB), walk_in_status, confirmation_count, last_confirmed_at, is_stale, notes
— `location` column has a GiST spatial index for fast geo queries at scale

**Walk-in statuses:**
- `walk_in_only` — green pin
- `bar_seating` — yellow pin
- `large_parties_only` — orange pin ("Walk-in for 1–4")
- `reservations_required` — grey pin, de-emphasized, hidden by default

**confirmations:** id, user_id, restaurant_id, status_submitted, note (140 char max), created_at

**users:** id (= Supabase auth UID), email, display_name, created_at

## API Design
- `GET /api/restaurants?bbox=sw_lat,sw_lng,ne_lat,ne_lng` — bounding-box filtered; loads only what the map viewport shows
- `GET /api/coverage` — returns active coverage_area polygons for empty-state logic and map overlay
- `POST /api/confirmations` — auth required; inserts confirmation, triggers founder email on "This changed"
- `POST /api/digest` — cron-secured; sends daily confirmation summary to founder

## Auth Rules
- Map browsing: always public, no auth required
- Submitting confirmations: requires Supabase magic link auth
- Admin digest endpoint: secured via `CRON_SECRET` header (set in Vercel env vars)

## Staleness Logic
- Stale threshold: 90 days with no confirmation
- Stale card display: "Last confirmed [date] — has anything changed?"
- Admin review trigger: 1 "This changed ✗" flag → real-time email to founder with restaurant name, new status, and optional user note

## Coding Conventions
- TypeScript strict mode throughout
- All DB access through Supabase client; never raw SQL in components
- RLS policies enforce row-level auth; API routes validate session
- No direct DB writes from the browser — all writes go through `/api/` routes
- Mobile-first components: large touch targets, no hover-only interactions
- Default map viewport must come from `cities` table, never hardcoded coordinates
- Restaurants API must always use bbox filtering, never return the full table

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server-side only — never expose to browser
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_POSTHOG_KEY=
CRON_SECRET=                      # secures /api/digest from unauthorized calls
```

## Out of Scope for MVP
Search by name, cuisine filters, user-generated restaurant additions, push notifications,
social sharing, rate limiting / abuse prevention, native mobile app, expansion beyond the
4 Brooklyn neighborhoods. Do not implement these even if they seem like natural additions.

## Git Workflow
- **Start of session:** run `git pull` to get latest changes from collaborators
- **End of session:** run `git push` to sync local changes to GitHub (triggers Vercel deploy)
- Remind Tomas to do both at the start and end of each session.

## Milestones
- **M1** — Project scaffold + DB migrations + seed data (expansion-aware schema)
- **M2** — Full-screen map with colored pins (bbox API from day one)
- **M3** — Restaurant card / bottom sheet (read-only)
- **M4** — Magic link auth (full round-trip)
- **M5** — Walk-in confirmation flow (core product interaction) ⭐
- **M6** — List view + user profile
- **M7** — Admin digest (Vercel Cron + Resend) + PostHog analytics
- **M8** — Pre-launch hardening (RLS audit, mobile QA, custom domain)
