import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { RestaurantMapPin } from "@/types/restaurant";

// GET /api/restaurants?bbox=sw_lat,sw_lng,ne_lat,ne_lng
// Returns restaurants within the map viewport bounding box.
// Always bbox-filtered — never returns the full table.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = searchParams.get("bbox");

  if (!bbox) {
    return NextResponse.json({ error: "bbox parameter required" }, { status: 400 });
  }

  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) {
    return NextResponse.json(
      { error: "bbox must be: sw_lat,sw_lng,ne_lat,ne_lng" },
      { status: 400 }
    );
  }

  const [sw_lat, sw_lng, ne_lat, ne_lng] = parts;

  const supabase = createClient();

  // Use PostGIS ST_MakeEnvelope to filter by bounding box
  const { data, error } = await supabase.rpc("restaurants_in_bbox", {
    sw_lat,
    sw_lng,
    ne_lat,
    ne_lng,
  });

  if (error) {
    console.error("restaurants_in_bbox error:", error);
    return NextResponse.json({ error: "Failed to fetch restaurants" }, { status: 500 });
  }

  const pins: RestaurantMapPin[] = data ?? [];

  return NextResponse.json(pins, {
    headers: {
      // Cache for 30s on CDN — fresh enough for walk-in status
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
