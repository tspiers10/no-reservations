import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Supabase redirects here after the user clicks the magic link in their email.
// We exchange the code for a session and redirect to the map.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/map`);
}
