import { NextRequest, NextResponse } from "next/server";

// GET /api/photos?ref=<photo_reference>&maxwidth=<n>
// Proxies Google Places photo requests server-side so the server API key
// never reaches the browser and browser-side IP/referrer restrictions are avoided.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref");
  const maxwidth = searchParams.get("maxwidth") ?? "800";

  if (!ref) {
    return NextResponse.json({ error: "ref required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxwidth}&photo_reference=${encodeURIComponent(ref)}&key=${apiKey}`;

  const upstream = await fetch(url, { redirect: "follow" });

  if (!upstream.ok) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  const buffer = await upstream.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
