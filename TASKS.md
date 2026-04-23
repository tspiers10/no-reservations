# No Reservations — Tasks

## In Progress

## Todo

### M8 Pre-Launch Hardening
- [ ] RLS audit: verify anon = read only, auth users = write own confirmations only
- [ ] Mobile device QA: bottom sheet and confirmation flow
- [ ] Lighthouse audit on map page (target >80 on mobile)
- [ ] Configure custom domain on Vercel
- [ ] Write one-page admin runbook (add restaurant, read digest, check for abuse)
- [ ] Soft launch to small group for 48h validation

### Design
- [ ] MEDIUM — Correct pin colors to match card status badge colors (crimson/amber/orange/grey scheme) — `src/components/map/MapContainer.tsx`
- [ ] LOW — Unify color scheme on sign-in modal and overall UI — `src/components/auth/AuthModal.tsx`, `src/components/auth/UserProfile.tsx`
- [ ] LOW — Redesign map pins (explore dots/custom shapes, must stay readable at small sizes) — `src/components/map/MapContainer.tsx`
- [ ] LOW — Add logo (placement TBD, appears on map UI and/or auth modal)

### Features
- [ ] LOW — Surface submission notes as restaurant tips on the card — `src/components/restaurant/RestaurantCard.tsx`, `supabase/migrations/`

## Done

- ✅ Restyle neighborhood boundary outlines (red → slate)
- ✅ Confirmation count cache fix (useMemo in displayRestaurants)
- ✅ Add restaurant feature (suggest modal, founder review queue, admin page)
- ✅ Restrict submissions to covered neighborhoods (PostGIS + client ray-cast)
- ✅ Brooklyn Heights neighborhood added
- ✅ List view as right side panel
- ✅ Deep Crimson color scheme
- ✅ Map/List toggle z-index fix
- ✅ Dark mode toggle with localStorage persistence
- ✅ Street View disabled
- ✅ Neighborhood boundary polygons on map
- ✅ Remove satellite map option
- ✅ Remove traffic overlay
- ✅ Remove zip code from address display
- ✅ Fix button overlap in list view
- ✅ M1–M8 complete and deployed to Vercel
