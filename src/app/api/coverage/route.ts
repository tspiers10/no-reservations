import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/coverage
// Returns active coverage area boundaries as GeoJSON polygons.
// Used to render neighborhood outlines on the map.
export async function GET() {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("get_coverage_areas");

  if (error) {
    console.error("get_coverage_areas error:", error);
    return NextResponse.json({ error: "Failed to fetch coverage areas" }, { status: 500 });
  }

  const areas = (data ?? []).map((area: { id: string; name: string; boundary_geojson: string }) => ({
    id: area.id,
    name: area.name,
    boundary: JSON.parse(area.boundary_geojson) as { type: string; coordinates: number[][][] },
  }));

  return NextResponse.json({ areas }, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
