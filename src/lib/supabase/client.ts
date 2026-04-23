import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client (singleton).
// Use this in React components and client-side hooks.
// Never use the service role key here — this runs in the browser.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
