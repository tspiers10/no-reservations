export type WalkInStatus =
  | "walk_in_only"       // green pin
  | "bar_seating"        // yellow pin
  | "large_parties_only" // orange pin
  | "reservations_required"; // grey pin — de-emphasized

export interface City {
  id: string;
  name: string;
  slug: string;
  center_lat: number;
  center_lng: number;
  is_active: boolean;
}

export interface CoverageArea {
  id: string;
  city_id: string;
  name: string;
  // GeoJSON polygon returned from /api/coverage
  boundary: { type: "Polygon"; coordinates: number[][][]; bbox?: number[] };
  is_active: boolean;
}

export interface RestaurantHours {
  monday?: { open: string; close: string } | null;
  tuesday?: { open: string; close: string } | null;
  wednesday?: { open: string; close: string } | null;
  thursday?: { open: string; close: string } | null;
  friday?: { open: string; close: string } | null;
  saturday?: { open: string; close: string } | null;
  sunday?: { open: string; close: string } | null;
}

export interface Restaurant {
  id: string;
  city_id: string;
  neighborhood_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_type: string | null;
  google_place_id: string | null;
  hours: RestaurantHours | null;
  walk_in_status: WalkInStatus;
  confirmation_count: number;
  confirmation_count_30d: number; // computed by restaurants_in_bbox RPC, not a DB column
  last_confirmed_at: string | null; // ISO timestamp
  is_stale: boolean;
  notes: string | null;
  photo_url: string | null;
  tip_summary: string | null;
}

// Community-submitted restaurant suggestion (pending founder review)
export interface RestaurantSubmission {
  id: string;
  user_id: string;
  city_id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  cuisine_type: string | null;
  walk_in_status: WalkInStatus;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "duplicate";
  submitted_at: string;
  reviewed_at: string | null;
  created_at: string;
  // Joined field from users table
  users?: { email: string } | null;
}

// Subset returned by /api/restaurants (no internal DB fields)
export type RestaurantMapPin = Pick<
  Restaurant,
  | "id"
  | "name"
  | "lat"
  | "lng"
  | "walk_in_status"
  | "cuisine_type"
  | "confirmation_count"
  | "confirmation_count_30d"
  | "last_confirmed_at"
  | "is_stale"
  | "hours"
  | "address"
  | "neighborhood_id"
  | "photo_url"
  | "tip_summary"
>;
