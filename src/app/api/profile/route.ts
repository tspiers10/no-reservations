import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profile — returns the signed-in user's confirmation history
export async function GET() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("confirmations")
    .select(`
      id,
      status_submitted,
      note,
      created_at,
      restaurants (
        id,
        name,
        address,
        walk_in_status
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }

  return NextResponse.json({ confirmations: data ?? [] });
}
