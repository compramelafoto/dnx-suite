import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { activePresencePoint, endOfDayArgentina } from "@/lib/agencies/presence";
import { parseDeclaredPoint } from "@/lib/agencies/photo-facts";
import { requireActiveAgencyMember } from "../membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ agencyId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  const p = await prisma.agencyMemberPresence.findUnique({
    where: { memberId: m.memberId },
    select: { lat: true, lng: true, placeId: true, validUntil: true },
  });
  if (!p || !activePresencePoint(p, new Date())) return NextResponse.json({ presence: null });
  return NextResponse.json({ presence: { lat: p.lat, lng: p.lng, placeId: p.placeId, validUntil: p.validUntil.toISOString() } });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  const body = (await req.json().catch(() => ({}))) as { placeId?: unknown; lat?: unknown; lng?: unknown };
  let point: { lat: number; lng: number } | null;
  let placeId: number | null = null;
  if (body.placeId != null) {
    const id = Number(body.placeId);
    const place = Number.isInteger(id) && id > 0
      ? await prisma.agencyPlace.findFirst({ where: { id, agencyId: m.agencyId }, select: { id: true, lat: true, lng: true } })
      : null;
    if (!place) return NextResponse.json({ error: "Ese lugar no es de la agencia." }, { status: 400 });
    point = { lat: place.lat, lng: place.lng };
    placeId = place.id;
  } else {
    point = parseDeclaredPoint(body.lat, body.lng);
    if (!point) return NextResponse.json({ error: "La ubicación no es válida." }, { status: 400 });
  }
  const validUntil = endOfDayArgentina(new Date());
  const data = { lat: point.lat, lng: point.lng, placeId, validUntil };
  const saved = await prisma.agencyMemberPresence.upsert({
    where: { memberId: m.memberId },
    create: { memberId: m.memberId, ...data },
    update: data,
  });
  return NextResponse.json({
    presence: { lat: saved.lat, lng: saved.lng, placeId: saved.placeId ?? null, validUntil: saved.validUntil.toISOString() },
  });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const m = await requireActiveAgencyMember(params);
  if ("res" in m) return m.res;
  await prisma.agencyMemberPresence.deleteMany({ where: { memberId: m.memberId } });
  return NextResponse.json({ ok: true });
}
