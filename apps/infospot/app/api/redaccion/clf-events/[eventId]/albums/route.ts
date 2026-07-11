import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { getClfEventSummary, listClfAlbumsForEvent } from "@/lib/clf-queries";

type Ctx = { params: Promise<{ eventId: string }> };

export async function GET(_request: Request, context: Ctx) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { eventId: raw } = await context.params;
  const eventId = Number(raw);
  if (!Number.isFinite(eventId) || eventId <= 0) {
    return NextResponse.json({ error: "eventId inválido" }, { status: 400 });
  }

  const event = await getClfEventSummary(eventId);
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });

  const albums = await listClfAlbumsForEvent(eventId);
  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      city: event.city,
      locationName: event.locationName,
      status: event.status,
      organizerName: event.creator.name?.trim() || event.creator.email,
    },
    albums,
  });
}
