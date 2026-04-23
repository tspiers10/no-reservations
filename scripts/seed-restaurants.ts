/**
 * seed-restaurants.ts
 *
 * Reads a CSV file of seed restaurants and inserts them into Supabase.
 * Also assigns each restaurant to the correct coverage_area (neighborhood)
 * by using a PostGIS ST_Contains spatial query.
 *
 * Run: npm run seed:restaurants
 * Requires:
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - supabase/seed/restaurants.csv (see column format below)
 *
 * CSV columns (header row required):
 *   name, address, lat, lng, cuisine_type, google_place_id, walk_in_status,
 *   hours_mon_open, hours_mon_close, hours_tue_open, hours_tue_close,
 *   hours_wed_open, hours_wed_close, hours_thu_open, hours_thu_close,
 *   hours_fri_open, hours_fri_close, hours_sat_open, hours_sat_close,
 *   hours_sun_open, hours_sun_close, notes
 *
 * walk_in_status values: walk_in_only | bar_seating | large_parties_only | reservations_required
 * hours format: "HH:MM" (24h) or leave blank for closed
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import * as dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CSV_PATH = path.resolve(process.cwd(), "supabase/seed/restaurants.csv");

type WalkInStatus =
  | "walk_in_only"
  | "bar_seating"
  | "large_parties_only"
  | "reservations_required";

interface CSVRow {
  name: string;
  address: string;
  lat: string;
  lng: string;
  cuisine_type: string;
  google_place_id: string;
  walk_in_status: string;
  hours_mon_open: string; hours_mon_close: string;
  hours_tue_open: string; hours_tue_close: string;
  hours_wed_open: string; hours_wed_close: string;
  hours_thu_open: string; hours_thu_close: string;
  hours_fri_open: string; hours_fri_close: string;
  hours_sat_open: string; hours_sat_close: string;
  hours_sun_open: string; hours_sun_close: string;
  notes: string;
}

function parseHours(row: CSVRow) {
  const day = (open: string, close: string) =>
    open && close ? { open, close } : null;

  return {
    monday:    day(row.hours_mon_open, row.hours_mon_close),
    tuesday:   day(row.hours_tue_open, row.hours_tue_close),
    wednesday: day(row.hours_wed_open, row.hours_wed_close),
    thursday:  day(row.hours_thu_open, row.hours_thu_close),
    friday:    day(row.hours_fri_open, row.hours_fri_close),
    saturday:  day(row.hours_sat_open, row.hours_sat_close),
    sunday:    day(row.hours_sun_open, row.hours_sun_close),
  };
}

async function readCSV(filePath: string): Promise<CSVRow[]> {
  const rows: CSVRow[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let headers: string[] = [];
  let isFirst = true;

  for await (const line of rl) {
    if (!line.trim()) continue;
    // Simple CSV parse — assumes no commas within quoted fields for now.
    // For production-quality CSV parsing, swap in a library like papaparse.
    const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));

    if (isFirst) {
      headers = cells;
      isFirst = false;
      continue;
    }

    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    rows.push(row as unknown as CSVRow);
  }

  return rows;
}

async function getNeighborhoodId(
  lat: number,
  lng: number,
  cityId: string
): Promise<string | null> {
  // Use PostGIS ST_Contains via a Supabase RPC function
  // We'll call a raw SQL query through the service role
  const { data, error } = await supabase.rpc("find_neighborhood", {
    p_lat: lat,
    p_lng: lng,
    p_city_id: cityId,
  });

  if (error) {
    // Non-fatal: restaurant may be on the boundary edge
    return null;
  }

  return (data as string) ?? null;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    console.error("Create supabase/seed/restaurants.csv first (see script header for columns)");
    process.exit(1);
  }

  console.log(`Reading ${CSV_PATH}…`);
  const rows = await readCSV(CSV_PATH);
  console.log(`Parsed ${rows.length} rows`);

  // Get Brooklyn city ID
  const { data: city, error: cityError } = await supabase
    .from("cities")
    .select("id")
    .eq("slug", "brooklyn")
    .single();

  if (cityError || !city) {
    throw new Error(`Brooklyn city not found: ${cityError?.message}`);
  }

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lng);

    if (isNaN(lat) || isNaN(lng)) {
      console.warn(`  ⚠ Skipping "${row.name}" — invalid lat/lng`);
      skipped++;
      continue;
    }

    const validStatuses: WalkInStatus[] = [
      "walk_in_only",
      "bar_seating",
      "large_parties_only",
      "reservations_required",
    ];
    const walkInStatus = validStatuses.includes(row.walk_in_status as WalkInStatus)
      ? (row.walk_in_status as WalkInStatus)
      : "walk_in_only";

    const neighborhoodId = await getNeighborhoodId(lat, lng, city.id);

    const record = {
      city_id: city.id,
      neighborhood_id: neighborhoodId,
      name: row.name,
      address: row.address,
      lat,
      lng,
      // PostGIS geography point — pass as WKT
      location: `POINT(${lng} ${lat})`,
      cuisine_type: row.cuisine_type || null,
      google_place_id: row.google_place_id || null,
      hours: parseHours(row),
      walk_in_status: walkInStatus,
      notes: row.notes?.slice(0, 140) || null,
      is_stale: true, // All seed data starts stale until first community confirmation
    };

    const { error } = await supabase
      .from("restaurants")
      .upsert(record, { onConflict: "google_place_id" });

    if (error) {
      console.warn(`  ⚠ Failed "${row.name}": ${error.message}`);
      skipped++;
    } else {
      console.log(`  ✓ ${row.name}`);
      inserted++;
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
