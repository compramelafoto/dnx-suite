import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { searchClfEvents } from "@/lib/clf-queries";
import { clfEventToAssistantCard } from "@/lib/editorial-assistant";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";
  let events = await searchClfEvents(q || city, 60);
  if (city) {
    const cityLower = city.toLowerCase();
    events = events.filter((e) => (e.city ?? "").toLowerCase().includes(cityLower));
  }
  return NextResponse.json({
    events: events.map((e) => clfEventToAssistantCard(e)),
  });
}
