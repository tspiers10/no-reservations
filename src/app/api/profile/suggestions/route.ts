import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profile/suggestions — returns the signed-in user's restaurant submission history
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("restaurant_submissions")
    .select("id, name, address, cuisine_type, walk_in_status, status, submitted_at, reviewed_at")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }

  return NextResponse.json({ suggestions: data ?? [] });
}
