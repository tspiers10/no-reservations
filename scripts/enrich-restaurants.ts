/**
 * enrich-restaurants.ts
 *
 * For each restaurant in the DB, calls the Google Places API to:
 *   1. Find the Place ID using name + address (Find Place from Text)
 *   2. Fetch opening hours and precise lat/lng (Place Details)
 *   3. Update the restaurant record in Supabase
 *
 * Restaurants that already have a google_place_id skip step 1.
 * Restaurants that already have hours are still updated (Google is the source of truth).
 *
 * Run: npm run enrich:restaurants
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mapsApiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !mapsApiKey) {
  console.error("Missing required env vars in .env.local (need GOOGLE_MAPS_SERVER_API_KEY)");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Google Places helpers ─────────────────────────────────────────────────────

const PLACES_BASE = "https://maps.googleapis.com/maps/api/place";

async function findPlaceId(name: string, address: string): Promise<string | null> {
  const query = encodeURIComponent(`${name} ${address} Brooklyn NY`);
  const url = `${PLACES_BASE}/textsearch/json?query=${query}&key=${mapsApiKey}`;
  const res = await fetch(url);
  const data = await res.json() as {
    status: string;
    results: { place_id: string }[];
  };

  if (data.status !== "OK" || !data.results.length) {
    console.error(`    [findPlace] status=${data.status}`);
    return null;
  }
  return data.results[0].place_id;
}

interface GooglePeriod {
  open: { day: number; time: string };
  close: { day: number; time: string };
}

interface PlaceDetails {
  place_id: string;
  geometry: { location: { lat: number; lng: number } };
  opening_hours?: { periods: GooglePeriod[] };
  photos?: { photo_reference: string }[];
}

async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const fields = "place_id,geometry,opening_hours,photos";
  const url = `${PLACES_BASE}/details/json?place_id=${placeId}&fields=${fields}&key=${mapsApiKey}`;
  const res = await fetch(url);
  const data = await res.json() as { status: string; result: PlaceDetails };

  if (data.status !== "OK") return null;
  return data.result;
}

// ── Hours conversion ──────────────────────────────────────────────────────────

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function formatTime(googleTime: string): string {
  // "1130" → "11:30"
  return `${googleTime.slice(0, 2)}:${googleTime.slice(2)}`;
}

function convertHours(periods: GooglePeriod[]) {
  const hours: Record<string, { open: string; close: string } | null> = {
    sunday: null, monday: null, tuesday: null, wednesday: null,
    thursday: null, friday: null, saturday: null,
  };

  for (const period of periods) {
    const day = DAY_NAMES[period.open.day];
    if (day && period.close) {
      hours[day] = {
        open: formatTime(period.open.time),
        close: formatTime(period.close.time),
      };
    }
  }

  return hours;
}

// ── Delay helper ──────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Fetching restaurants from Supabase…\n");

  const { data: restaurants, error } = await supabase
    .from("restaurants")
    .select("id, name, address, google_place_id")
    .order("name");

  if (error || !restaurants) {
    throw new Error(`Failed to fetch restaurants: ${error?.message}`);
  }

  console.log(`Found ${restaurants.length} restaurant(s) to enrich.\n`);

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  for (const restaurant of restaurants) {
    process.stdout.write(`  ${restaurant.name}… `);

    // Step 1 — find Place ID if missing
    let placeId = restaurant.google_place_id;
    if (!placeId) {
      placeId = await findPlaceId(restaurant.name, restaurant.address);
      await sleep(200); // stay well under rate limits
      if (!placeId) {
        console.log("✗ Place not found");
        failed++;
        continue;
      }
    }

    // Step 2 — fetch details
    const details = await getPlaceDetails(placeId);
    await sleep(200);

    if (!details) {
      console.log("✗ Details fetch failed");
      failed++;
      continue;
    }

    // Step 3 — build update
    const update: Record<string, unknown> = {
      google_place_id: placeId,
      lat: details.geometry.location.lat,
      lng: details.geometry.location.lng,
      location: `POINT(${details.geometry.location.lng} ${details.geometry.location.lat})`,
    };

    if (details.opening_hours?.periods?.length) {
      update.hours = convertHours(details.opening_hours.periods);
    }

    if (details.photos?.length) {
      const ref = details.photos[0].photo_reference;
      update.photo_url = `${PLACES_BASE}/photo?maxwidth=800&photo_reference=${ref}&key=${mapsApiKey}`;
    }

    const { error: updateError } = await supabase
      .from("restaurants")
      .update(update)
      .eq("id", restaurant.id);

    if (updateError) {
      console.log(`✗ DB update failed: ${updateError.message}`);
      failed++;
    } else {
      const notes = [
        details.opening_hours ? "hours" : null,
        details.photos?.length ? "photo" : null,
      ].filter(Boolean).join(", ");
      console.log(`✓ (${notes || "no extras"})`);
      enriched++;
    }
  }

  console.log(`\nDone. Enriched: ${enriched} | Not found: ${failed} | Skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Enrich failed:", err);
  process.exit(1);
});
