import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { ConfirmationPayload } from "@/types/confirmation";
import { summarizeTips } from "@/lib/summarize-tips";

export async function POST(req: NextRequest) {
  // Validate session — auth required
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ConfirmationPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { restaurant_id, status_submitted, note } = body;

  if (!restaurant_id || !status_submitted) {
    return NextResponse.json(
      { error: "restaurant_id and status_submitted are required" },
      { status: 400 }
    );
  }

  const validStatuses = [
    "still_walk_in",
    "walk_in_only",
    "bar_seating",
    "large_parties_only",
    "reservations_required",
  ];

  if (!validStatuses.includes(status_submitted)) {
    return NextResponse.json({ error: "Invalid status_submitted" }, { status: 400 });
  }

  if (note && note.length > 140) {
    return NextResponse.json({ error: "Note must be 140 characters or less" }, { status: 400 });
  }

  // Use service role to bypass RLS for the insert
  // (the trigger handle_new_confirmation updates restaurants + users counts)
  const service = createServiceClient();

  // Enforce 30-day rolling window: one confirmation per user per restaurant
  const windowStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await service
    .from("confirmations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("restaurant_id", restaurant_id)
    .gte("created_at", windowStart);

  if (count && count > 0) {
    return NextResponse.json(
      { error: "already_confirmed", message: "You already confirmed this restaurant in the last 30 days." },
      { status: 429 }
    );
  }

  const { data, error } = await service
    .from("confirmations")
    .insert({
      user_id: user.id,
      restaurant_id,
      status_submitted,
      note: note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Confirmation insert error:", error);
    return NextResponse.json({ error: "Failed to save confirmation" }, { status: 500 });
  }

  // If status changed, notify founder via email (M7 — placeholder for now)
  if (status_submitted !== "still_walk_in") {
    // TODO M7: send Resend email to founder
  }

  // Regenerate tip summary when the confirmation includes a note
  if (note) {
    summarizeTips(restaurant_id).catch(console.error);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
