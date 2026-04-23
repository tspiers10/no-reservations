import { createClient, createServiceClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { summarizeTips } from "@/lib/summarize-tips";

async function assertFounder() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (user.email !== process.env.FOUNDER_EMAIL) return null;
  return user;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await assertFounder();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const service = createServiceClient();

  // Fetch the submission
  const { data: submission, error: fetchError } = await service
    .from("restaurant_submissions")
    .select("*")
    .eq("id", id)
    .eq("status", "pending")
    .single();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found or already reviewed" }, { status: 404 });
  }

  // Auto-detect neighborhood via existing find_neighborhood RPC (PostGIS ST_Contains)
  const { data: neighborhoodId } = await service
    .rpc("find_neighborhood", {
      p_lat: submission.lat,
      p_lng: submission.lng,
      p_city_id: submission.city_id,
    });

  // Insert into restaurants table
  const { data: newRestaurant, error: insertError } = await service
    .from("restaurants")
    .insert({
      city_id: submission.city_id,
      neighborhood_id: (neighborhoodId as string | null) ?? null,
      name: submission.name,
      address: submission.address,
      lat: submission.lat,
      lng: submission.lng,
      location: `SRID=4326;POINT(${submission.lng} ${submission.lat})`,
      cuisine_type: submission.cuisine_type ?? null,
      walk_in_status: submission.walk_in_status,
      confirmation_count: 0,
      is_stale: false,
      notes: submission.note ?? null,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Restaurant insert error:", insertError);
    return NextResponse.json({ error: "Failed to create restaurant" }, { status: 500 });
  }

  // Mark submission as approved
  await service
    .from("restaurant_submissions")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  // Generate tip summary if the submission included a note
  if (submission.note) {
    summarizeTips(newRestaurant.id).catch(console.error);
  }

  return NextResponse.json({ restaurantId: newRestaurant.id });
}
