# No Reservations — Tickets

## Open

### HIGH — Fix "undefined confirmations" on restaurant card
The restaurant card shows "undefined confirmations in the last 30 days". The `confirmation_count_30d` column either doesn't exist in the DB or isn't being returned by the `restaurants_in_bbox` RPC. Needs a migration to add the column (or confirm it exists), update the RPC to return it, and verify the card displays correctly.
**Files:** `supabase/migrations/`, `src/components/restaurant/RestaurantCard.tsx`, `src/types/restaurant.ts`

### HIGH — Restore restaurant photos on map tabs
Photos that previously appeared on restaurant tabs/cards are no longer showing. The `photo_url` column either isn't being returned by `restaurants_in_bbox` or was never in the DB. Needs the same audit as above — confirm the column exists, add it to the RPC return type, and restore display.
**Files:** `supabase/migrations/`, `src/types/restaurant.ts`, `src/components/restaurant/RestaurantCard.tsx`

### LOW — Redesign map pins
Current pins are teardrop SVGs with a white inner circle. Explore alternative pin designs — e.g. simpler dots, custom shapes, or icons. Should remain clearly colored by status and readable at small sizes.
**Files:** `src/components/map/MapContainer.tsx`
**Notes:** Will be handled by the Claude Design redesign.

### LOW — Add logo
Design and add a logo to the app — should appear on the map UI and/or the auth modal. TBD on placement and design direction.
**Notes:** Will be handled by the Claude Design redesign.

### MEDIUM — Correct pin colors to match card status badge colors
Walk-in pins are green but the card status badge is red/crimson. All pin colors should be reviewed and aligned with the overall Deep Crimson color scheme where appropriate (walk-in = crimson, bar seating = amber, large parties = orange, reservations = grey).
**Files:** `src/components/map/MapContainer.tsx`
**Notes:** Will be handled by the Claude Design redesign.

### LOW — Unify color scheme on sign-in modal and overall UI
The sign-in popup and other UI elements don't fully match the Deep Crimson color scheme. Audit all modals, buttons, and interactive elements for consistency.
**Files:** `src/components/auth/AuthModal.tsx`, `src/components/auth/UserProfile.tsx`
**Notes:** Will be handled by the Claude Design redesign.



## Closed

- ✅ LOW — Surface submission notes as restaurant tips (AI-generated summary via Claude Haiku)

- ✅ LOW — "Add restaurant" button overlaps list panel
- ✅ LOW — Remove zip code from address display
- ✅ LOW — Fix button overlap in list view
- ✅ LOW — Remove traffic overlay from map
- ✅ HIGH — Add restaurant feature (suggest modal, founder review queue, admin page, user suggestions history)
- ✅ LOW — Remove zip code from address display
- ✅ LOW — Fix button overlap in list view
- ✅ LOW — Restyle neighborhood boundary outlines (slate, not red)
- ✅ LOW — Confirmation count doesn't update on card re-open
- ✅ MEDIUM — Restrict restaurant submissions to covered neighborhoods (PostGIS boundary check + client-side ray-cast)
- ✅ LOW — Add Brooklyn Heights as a supported neighborhood
- ✅ MEDIUM — List view as side panel
- ✅ MEDIUM — Change color scheme to Deep Crimson
- ✅ HIGH — Map/List toggle disappears in list view
- ✅ LOW — Disable Street View on map
- ✅ LOW — Show neighborhood boundary outlines on map
- ✅ LOW — Remove satellite map option
- ✅ LOW — Light / dark mode toggle
