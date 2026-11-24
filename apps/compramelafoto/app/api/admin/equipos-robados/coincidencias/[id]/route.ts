import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStolenGearAdmin } from "@/lib/stolen-gear/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES = ["NEW", "REVIEWING", "CONFIRMED", "DISMISSED"] as const;

/** El admin marca una coincidencia (revisando, confirmada, descartada) y anota. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { denied } = await requireStolenGearAdmin();
  if (denied) return denied;
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { status?: string; notes?: string };
  const data: { status?: (typeof STATUSES)[number]; adminNotes?: string | null } = {};
  if (body.status) {
    if (!STATUSES.includes(body.status as (typeof STATUSES)[number])) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.status = body.status as (typeof STATUSES)[number];
  }
  if (typeof body.notes === "string") data.adminNotes = body.notes.slice(0, 4000) || null;
  await prisma.stolenGearMatch.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}
