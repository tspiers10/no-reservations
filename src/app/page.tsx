import { redirect } from "next/navigation";

// Root route redirects to the map view (primary entry point)
export default function Home() {
  redirect("/map");
}
