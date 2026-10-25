import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwnedAgency } from "@/lib/agencies/owner-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const places = await prisma.agencyPlace.findMany({
    where: { agencyId: a.agency.id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lat: true, lng: true },
  });
  return NextResponse.json({ places });
}

export async function POST(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; lat?: unknown; lng?: unknown };
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!name) return NextResponse.json({ error: "Poné el nombre del lugar." }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ error: "Marcá el lugar en el mapa." }, { status: 400 });
  }
  const place = await prisma.agencyPlace.create({ data: { agencyId: a.agency.id, name, lat, lng } });
  return NextResponse.json({ place: { id: place.id, name: place.name, lat: place.lat, lng: place.lng } }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const a = await requireOwnedAgency();
  if ("res" in a) return a.res;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Lugar inválido." }, { status: 400 });
  const { count } = await prisma.agencyPlace.deleteMany({ where: { id, agencyId: a.agency.id } });
  if (count === 0) return NextResponse.json({ error: "Ese lugar no es de la agencia." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
