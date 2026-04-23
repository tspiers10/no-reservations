import { GoogleGenerativeAI } from "@google/generative-ai";
import { createServiceClient } from "@/lib/supabase/server";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genai.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function summarizeTips(restaurantId: string): Promise<void> {
  const service = createServiceClient();

  const [{ data: restaurant }, { data: confirmations }] = await Promise.all([
    service.from("restaurants").select("name, notes").eq("id", restaurantId).single(),
    service
      .from("confirmations")
      .select("note")
      .eq("restaurant_id", restaurantId)
      .not("note", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const notes: string[] = [];
  if (restaurant?.notes) notes.push(restaurant.notes);
  if (confirmations) {
    for (const c of confirmations) {
      if (c.note) notes.push(c.note);
    }
  }

  if (notes.length === 0) {
    await service.from("restaurants").update({ tip_summary: null }).eq("id", restaurantId);
    return;
  }

  const prompt = `You write concise, practical tips for a walk-in restaurant app. Be direct and specific. No filler phrases like "visitors say" or "according to reviews".

Restaurant: ${restaurant?.name ?? "Unknown"}

Community notes:
${notes.map((n, i) => `${i + 1}. ${n}`).join("\n")}

Write a 1–2 sentence tip summary highlighting the most useful walk-in information. Write only the summary.`;

  const result = await model.generateContent(prompt);
  const summary = result.response.text().trim();

  if (summary) {
    await service
      .from("restaurants")
      .update({ tip_summary: summary })
      .eq("id", restaurantId);
  }
}
