import type { WalkInStatus } from "./restaurant";

export interface Confirmation {
  id: string;
  user_id: string;
  restaurant_id: string;
  status_submitted: WalkInStatus | "still_walk_in";
  note: string | null;
  created_at: string;
}

export interface ConfirmationPayload {
  restaurant_id: string;
  status_submitted: WalkInStatus | "still_walk_in";
  note?: string;
}
