import { createClient } from "@/lib/supabase/server";
import { MapContainer } from "@/components/map/MapContainer";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const supabase = createClient();

  const { data: city } = await supabase
    .from("cities")
    .select("center_lat, center_lng")
    .eq("slug", "brooklyn")
    .eq("is_active", true)
    .single();

  // Fallback only if DB is unreachable during dev
  const lat = city?.center_lat ?? 40.6782;
  const lng = city?.center_lng ?? -73.9442;

  return (
    <main className="w-full h-screen">
      <MapContainer
        defaultLat={lat}
        defaultLng={lng}
        defaultZoom={15}
      />
    </main>
  );
}
