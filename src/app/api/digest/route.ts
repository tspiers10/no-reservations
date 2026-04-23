import { createServiceClient } from "@/lib/supabase/server";
import { sendDailyDigest } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

// POST /api/digest — triggered daily by Vercel Cron
// Secured by CRON_SECRET header to prevent unauthorized calls.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("confirmations")
    .select(`
      status_submitted,
      note,
      created_at,
      restaurants ( name ),
      users ( email )
    `)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Digest query error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const confirmations = (data ?? []).map((c) => ({
    restaurant_name: (c.restaurants as unknown as { name: string } | null)?.name ?? "Unknown",
    status_submitted: c.status_submitted,
    note: c.note,
    created_at: c.created_at,
    user_email: (c.users as unknown as { email: string } | null)?.email ?? "Unknown",
  }));

  await sendDailyDigest(confirmations);

  return NextResponse.json({ sent: confirmations.length });
}
