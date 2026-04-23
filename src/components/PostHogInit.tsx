"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/posthog";

// Initialises PostHog once on the client side.
// Kept as a separate component so layout.tsx stays a Server Component.
export function PostHogInit() {
  useEffect(() => {
    initPostHog();
  }, []);

  return null;
}
