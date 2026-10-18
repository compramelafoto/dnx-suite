import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { bpsToPercentLabel, planRequest, resolveAgencyTerms, sortByDistanceKm } from "@/lib/agencies/rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_DISTANCE_KM = 500;

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) } as const;
  return { user } as const;
}

export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  const me = await prisma.user.findUnique({ where: { id: a.user.id }, select: { latitude: true, longitude: true } });
  const rows = await prisma.agency.findMany({
    where: { directoryListed: true, ownerUserId: { not: a.user.id }, directoryLat: { not: null }, directoryLng: { not: null } },
    select: { id: true, name: true, logoUrl: true, description: true, directoryCity: true, directoryLat: true, directoryLng: true, defaultCommissionBps: true },
    take: 1000,
  });
  const mine = await prisma.agencyMember.findMany({
    where: { userId: a.user.id, status: { in: ["ACTIVE", "REQUESTED"] } },
    select: { agencyId: true, status: true },
  });
  const statusBy = new Map(mine.map((m) => [m.agencyId, m.status as "ACTIVE" | "REQUESTED"]));
  const toDto = (r: (typeof rows)[number], distanceKm: number | null) => ({
    agencyId: r.id,
    name: r.name,
    logoUrl: r.logoUrl,
    description: r.description,
    city: r.directoryCity,
    distanceKm: distanceKm === null ? null : Math.round(distanceKm),
    commissionLabel: bpsToPercentLabel(r.defaultCommissionBps),
    myStatus: statusBy.get(r.id) ?? null,
  });

  const hasLocation = me?.latitude != null && me?.longitude != null;
  if (!hasLocation) {
    const byName = [...rows].sort((x, y) => x.name.localeCompare(y.name, "es")).slice(0, 100);
    return NextResponse.json({ noLocation: true, agencies: byName.map((r) => toDto(r, null)) });
  }
  const sorted = sortByDistanceKm(
    rows.map((r) => ({ ...r, lat: r.directoryLat as number, lng: r.directoryLng as number })),
    { lat: me!.latitude as number, lng: me!.longitude as number }
  )
    .filter((r) => r.distanceKm <= MAX_DISTANCE_KM)
    .slice(0, 100);
  return NextResponse.json({ noLocation: false, agencies: sorted.map((r) => toDto(r, r.distanceKm)) });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const body = (await req.json().catch(() => ({}))) as { agencyId?: unknown; message?: unknown; acceptTerms?: unknown };
  if (body.acceptTerms !== true) {
    return NextResponse.json({ error: "Para pedir sumarte tenés que aceptar las condiciones de la agencia." }, { status: 400 });
  }
  const agencyId = Number(body.agencyId);
  if (!Number.isInteger(agencyId) || agencyId <= 0) return NextResponse.json({ error: "Agencia inválida." }, { status: 400 });
  const agency = await prisma.agency.findFirst({
    where: { id: agencyId, directoryListed: true },
    select: { id: true, ownerUserId: true, termsText: true, termsVersion: true },
  });
  if (!agency) return NextResponse.json({ error: "Esa agencia no está en el directorio." }, { status: 404 });
  if (agency.ownerUserId === a.user.id) return NextResponse.json({ error: "Es tu propia agencia." }, { status: 409 });

  const existing = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId, userId: a.user.id } },
    select: { id: true, status: true },
  });
  const plan = planRequest(existing);
  if (plan.action === "already_active" || plan.action === "already_requested") {
    return NextResponse.json({ outcome: plan.action });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 600) || null : null;
  const data = {
    status: "REQUESTED",
    requestMessage: message,
    termsVersionAccepted: agency.termsVersion,
    termsAcceptedAt: new Date(),
    termsAcceptedText: resolveAgencyTerms(agency),
    removedAt: null,
  };
  if (plan.action === "create") {
    await prisma.agencyMember.create({ data: { agencyId, userId: a.user.id, ...data } });
  } else {
    await prisma.agencyMember.update({ where: { id: existing!.id }, data });
  }
  return NextResponse.json({ outcome: "requested" });
}
