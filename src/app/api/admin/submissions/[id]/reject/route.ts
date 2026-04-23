import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

async function assertFounder() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.email !== process.env.FOUNDER_EMAIL) return null;
  return user;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await assertFounder();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const service = createServiceClient();

  const { error } = await service
    .from("restaurant_submissions")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    console.error("Reject submission error:", error);
    return NextResponse.json({ error: "Failed to reject submission" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
