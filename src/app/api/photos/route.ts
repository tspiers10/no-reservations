import { NextRequest, NextResponse } from "next/server";

// GET /api/photos?place_id=<google_place_id>
// Fetches a fresh photo reference from the Places API then streams the image
// back to the browser. Always server-side so the API key never reaches clients
// and photo references never expire (fetched fresh each time, cached 24h).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("place_id");

  if (!placeId) {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  // Step 1: fetch a fresh photo_reference from Place Details
  const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=photos&key=${apiKey}`;
  const detailsRes = await fetch(detailsUrl);
  const details = await detailsRes.json() as {
    status: string;
    result?: { photos?: { photo_reference: string }[] };
  };

  const ref = details.result?.photos?.[0]?.photo_reference;
  if (!ref) {
    return NextResponse.json({ error: "No photo available" }, { status: 404 });
  }

  // Step 2: fetch the actual image
  const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;
  const photoRes = await fetch(photoUrl, { redirect: "follow" });

  if (!photoRes.ok) {
    return NextResponse.json({ error: "Photo fetch failed" }, { status: 502 });
  }

  const contentType = photoRes.headers.get("content-type") ?? "image/jpeg";
  const buffer = await photoRes.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      // Cache 24h on CDN; serve stale for up to 7 days while revalidating
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}
