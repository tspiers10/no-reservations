import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Admin-only: returns all pending restaurant submissions
// Auth: must be signed in AND email must match FOUNDER_EMAIL env var
async function assertFounder() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.email !== process.env.FOUNDER_EMAIL) return null;
  return user;
}

export async function GET() {
  const user = await assertFounder();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();

  // Fetch pending submissions with submitter email via join on users table
  const { data, error } = await service
    .from("restaurant_submissions")
    .select(`
      id,
      name,
      address,
      lat,
      lng,
      cuisine_type,
      walk_in_status,
      note,
      status,
      submitted_at,
      user_id,
      users ( email )
    `)
    .eq("status", "pending")
    .order("submitted_at", { ascending: true });

  if (error) {
    console.error("Admin submissions fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}
