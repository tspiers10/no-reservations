/**
 * seed-coverage-areas.ts
 *
 * Fetches real neighborhood polygon boundaries from the NYC Open Data API
 * (Neighborhood Tabulation Areas / NTAs, sourced from NYC Dept of City Planning)
 * and inserts them into the coverage_areas table via the upsert_coverage_area RPC.
 *
 * Run: npm run seed:coverage
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const NYC_NTA_API = "https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson";

// Display name → exact NTA name in the NYC dataset
// If a neighborhood is skipped, check the printed list below to find the right name.
const BROOKLYN_NEIGHBORHOODS: Record<string, string> = {
  "Park Slope":        "Park Slope",
  "Boerum Hill":       "Downtown Brooklyn-DUMBO-Boerum Hill",
  "Fort Greene":       "Fort Greene",
  "Prospect Heights":  "Prospect Heights",
  "Cobble Hill":       "Carroll Gardens-Cobble Hill-Gowanus-Red Hook",
  "Brooklyn Heights":  "Brooklyn Heights",
};

// Manhattan launch neighborhoods — highest walk-in density
const MANHATTAN_NEIGHBORHOODS: Record<string, string> = {
  "East Village":   "East Village",
  "West Village":   "West Village",
  "Lower East Side": "Lower East Side",
  "Chinatown":      "Chinatown-Two Bridges",
};

interface NTAFeature {
  type: "Feature";
  geometry: { type: string; coordinates: unknown };
  properties: { ntaname: string; nta2020: string; boroname: string };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: NTAFeature[];
}

async function seedNeighborhoods(
  geojson: GeoJSONCollection,
  cityId: string,
  citySlug: string,
  boroname: string,
  neighborhoods: Record<string, string>
) {
  let inserted = 0;

  for (const [displayName, ntaName] of Object.entries(neighborhoods)) {
    const feature = geojson.features.find(
      (f) =>
        f.properties.ntaname.toLowerCase() === ntaName.toLowerCase() &&
        f.properties.boroname === boroname
    );

    if (!feature) {
      console.warn(`  ⚠ Could not find NTA for "${ntaName}" in ${boroname} — skipping`);
      continue;
    }

    const { error } = await supabase.rpc("upsert_coverage_area", {
      p_city_id: cityId,
      p_name: displayName,
      p_geojson: JSON.stringify(feature.geometry),
    });

    if (error) {
      console.error(`  ✗ Failed "${displayName}": ${error.message}`);
    } else {
      console.log(`  ✓ Seeded: ${displayName}`);
      inserted++;
    }
  }

  console.log(`  → ${citySlug}: ${inserted}/${Object.keys(neighborhoods).length} neighborhoods seeded.\n`);
  return inserted;
}

async function main() {
  console.log("Fetching NYC NTA boundaries from NYC Open Data…");

  const res = await fetch(NYC_NTA_API);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

  const geojson = (await res.json()) as GeoJSONCollection;
  console.log(`Fetched ${geojson.features.length} NTA features\n`);

  // ── Brooklyn ──────────────────────────────────────────────
  const { data: brooklynCity, error: brooklynError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", "brooklyn")
    .single();

  if (brooklynError || !brooklynCity) throw new Error(`Brooklyn city not found: ${brooklynError?.message}`);

  console.log("Seeding Brooklyn neighborhoods…");
  await seedNeighborhoods(geojson, brooklynCity.id, "brooklyn", "Brooklyn", BROOKLYN_NEIGHBORHOODS);

  // ── Manhattan ─────────────────────────────────────────────
  const { data: manhattanCity, error: manhattanError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", "manhattan")
    .single();

  if (manhattanError || !manhattanCity) {
    console.warn("Manhattan city not found — run the 20260418000002_manhattan_city.sql migration first.");
  } else {
    console.log("Seeding Manhattan neighborhoods…");
    await seedNeighborhoods(geojson, manhattanCity.id, "manhattan", "Manhattan", MANHATTAN_NEIGHBORHOODS);
  }

  console.log("All done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
