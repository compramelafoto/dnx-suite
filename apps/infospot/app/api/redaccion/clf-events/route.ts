import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { searchClfEvents } from "@/lib/clf-queries";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const events = await searchClfEvents(q);
  return NextResponse.json({ events });
}
