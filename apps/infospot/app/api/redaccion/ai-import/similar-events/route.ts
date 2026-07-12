import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import {
  canCreateInfoSpotArticle,
  getInfoSpotMembership,
  toPermissionSubject,
} from "@/lib/infospot-access";
import { searchClfEvents } from "@/lib/clf-queries";
import type { SimilarEventHit } from "@/lib/ai-import/similar-events";

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const subject = toPermissionSubject(user, await getInfoSpotMembership(user.id));
  if (!canCreateInfoSpotArticle(subject)) {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const eventDate = searchParams.get("eventDate")?.trim() || null;
  if (q.length < 2) return NextResponse.json({ events: [] as SimilarEventHit[] });

  const hits: SimilarEventHit[] = [];

  const infoSpot = await prisma.infoSpotEvent.findMany({
    where: {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { city: { contains: q.split(/\s+/)[0] ?? q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      title: true,
      startAt: true,
      city: true,
      province: true,
      venueName: true,
    },
    orderBy: { startAt: "desc" },
    take: 8,
  });

  for (const e of infoSpot) {
    hits.push({
      source: "INFOSPOT",
      id: e.id,
      title: e.title,
      startsAt: e.startAt.toISOString(),
      city: e.city,
      province: e.province,
      locationName: e.venueName,
    });
  }

  try {
    const clf = await searchClfEvents(q, 8);
    for (const e of clf) {
      hits.push({
        source: "CLF",
        id: String(e.id),
        title: e.title,
        startsAt: e.startsAt ? new Date(e.startsAt).toISOString() : null,
        city: e.city,
        locationName: e.locationName,
      });
    }
  } catch {
    // CLF read-only puede no estar configurado en todos los entornos.
  }

  let filtered = hits;
  if (eventDate && /^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    const sameDay = hits.filter((h) => h.startsAt?.slice(0, 10) === eventDate);
    if (sameDay.length > 0) filtered = sameDay;
  }

  return NextResponse.json({ events: filtered.slice(0, 12) });
}
