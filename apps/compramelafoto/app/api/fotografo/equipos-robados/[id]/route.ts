import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** El fotógrafo puede retirar su denuncia o avisar que recuperó el equipo. */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const id = Number((await context.params).id);
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  const report = await prisma.stolenGearReport.findFirst({
    where: { id, reporterId: user.id },
    select: { status: true },
  });
  if (!report) return NextResponse.json({ error: "Denuncia no encontrada" }, { status: 404 });
  if (report.status !== "PENDING_REVIEW" && report.status !== "ACTIVE") {
    return NextResponse.json({ error: "Esta denuncia ya está cerrada." }, { status: 409 });
  }

  if (body.action === "withdraw") {
    await prisma.stolenGearReport.update({ where: { id }, data: { status: "WITHDRAWN" } });
  } else if (body.action === "recovered") {
    await prisma.stolenGearReport.update({ where: { id }, data: { status: "RECOVERED", recoveredAt: new Date() } });
  } else {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
