import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendNewSubmissionEmail } from "@/lib/email";
import type { WalkInStatus } from "@/types/restaurant";

const VALID_WALK_IN_STATUSES: WalkInStatus[] = [
  "walk_in_only",
  "bar_seating",
  "large_parties_only",
  "reservations_required",
];

export async function POST(req: NextRequest) {
  // Auth required — anonymous submissions not accepted
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
    walk_in_status?: string;
    cuisine_type?: string;
    note?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, address, lat, lng, walk_in_status, cuisine_type, note } = body;

  // Required field validation
  if (!name || !address || lat == null || lng == null || !walk_in_status) {
    return NextResponse.json(
      { error: "name, address, lat, lng, and walk_in_status are required" },
      { status: 400 }
    );
  }

  if (!VALID_WALK_IN_STATUSES.includes(walk_in_status as WalkInStatus)) {
    return NextResponse.json({ error: "Invalid walk_in_status" }, { status: 400 });
  }

  if (name.length > 100) {
    return NextResponse.json({ error: "Name must be 100 characters or less" }, { status: 400 });
  }

  if (cuisine_type && cuisine_type.length > 50) {
    return NextResponse.json({ error: "Cuisine type must be 50 characters or less" }, { status: 400 });
  }

  if (note && note.length > 140) {
    return NextResponse.json({ error: "Note must be 140 characters or less" }, { status: 400 });
  }

  const service = createServiceClient();

  // Reject submissions outside active coverage areas
  const { data: withinCoverage, error: coverageError } = await service.rpc(
    "is_within_coverage",
    { p_lat: lat, p_lng: lng }
  );

  if (coverageError) {
    console.error("Coverage check error:", coverageError);
    return NextResponse.json({ error: "Could not verify location" }, { status: 500 });
  }

  if (!withinCoverage) {
    return NextResponse.json(
      { error: "This restaurant is outside our current coverage area. We currently cover Park Slope, Boerum Hill, Fort Greene, Prospect Heights, and Brooklyn Heights." },
      { status: 400 }
    );
  }

  // Look up the active city (Brooklyn for MVP — use the single active city)
  const { data: city, error: cityError } = await service
    .from("cities")
    .select("id")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (cityError || !city) {
    console.error("City lookup error:", cityError);
    return NextResponse.json({ error: "Could not resolve city" }, { status: 500 });
  }

  const { data, error } = await service
    .from("restaurant_submissions")
    .insert({
      user_id: user.id,
      city_id: city.id,
      name,
      address,
      lat,
      lng,
      cuisine_type: cuisine_type ?? null,
      walk_in_status,
      note: note ?? null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Submission insert error:", error);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  // Notify founder — best-effort (don't fail the request if email fails)
  try {
    await sendNewSubmissionEmail({
      name,
      address,
      cuisine_type: cuisine_type ?? null,
      walk_in_status,
      note: note ?? null,
      submitterEmail: user.email ?? "unknown",
    });
  } catch (emailErr) {
    console.error("Submission email error:", emailErr);
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
