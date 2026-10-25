import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { validateAgencyInput } from "@/lib/agencies/rules";
import { toAgencyDto } from "@/lib/agencies/dto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  return { user };
}

export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  const agency = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  return NextResponse.json({ agency: agency ? toAgencyDto(agency) : null });
}

export async function POST(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const existing = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  if (existing) return NextResponse.json({ error: "Ya tenés una agencia." }, { status: 409 });
  const parsed = validateAgencyInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const agency = await prisma.agency.create({ data: { ownerUserId: a.user.id, ...parsed.data } });
  return NextResponse.json({ agency: toAgencyDto(agency) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const a = await auth();
  if ("res" in a) return a.res;
  const existing = await prisma.agency.findUnique({ where: { ownerUserId: a.user.id } });
  if (!existing) return NextResponse.json({ error: "Todavía no creaste tu agencia." }, { status: 404 });
  const parsed = validateAgencyInput(await req.json().catch(() => ({})));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Cambiar las condiciones obliga al equipo a aceptarlas de nuevo antes de seguir subiendo.
  const termsChanged = (parsed.data.termsText ?? null) !== (existing.termsText ?? null);
  const agency = await prisma.agency.update({
    where: { id: existing.id },
    data: { ...parsed.data, termsVersion: termsChanged ? existing.termsVersion + 1 : existing.termsVersion },
  });
  return NextResponse.json({ agency: toAgencyDto(agency) });
}
