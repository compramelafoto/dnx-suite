import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStolenGearAdmin } from "@/lib/stolen-gear/admin";
import { scanStolenGear } from "@/lib/stolen-gear/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Acciones del admin sobre una denuncia:
 * approve (y cruza en el momento), reject (con motivo), recovered, reopen, notes.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  const { user, denied } = await requireStolenGearAdmin();
  if (denied || !user) return denied;
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string; notes?: string };
  const report = await prisma.stolenGearReport.findUnique({ where: { id }, select: { status: true } });
  if (!report) return NextResponse.json({ error: "No encontrada" }, { status: 404 });

  switch (body.action) {
    case "approve": {
      await prisma.stolenGearReport.update({
        where: { id },
        data: { status: "ACTIVE", reviewedById: user.id, reviewedAt: new Date(), rejectionReason: null },
      });
      const scan = await scanStolenGear({ reportId: id });
      // El aviso por correo lo manda el cruce diario; acá el admin ya está mirando el panel.
      if (scan.newMatches > 0) {
        await prisma.stolenGearMatch.updateMany({ where: { reportId: id, notifiedAt: null }, data: { notifiedAt: new Date() } });
      }
      return NextResponse.json({ ok: true, newMatches: scan.newMatches });
    }
    case "reject": {
      const reason = (body.reason ?? "").trim().slice(0, 500);
      if (!reason) return NextResponse.json({ error: "Escribí el motivo." }, { status: 400 });
      await prisma.stolenGearReport.update({
        where: { id },
        data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), rejectionReason: reason },
      });
      return NextResponse.json({ ok: true });
    }
    case "recovered":
      await prisma.stolenGearReport.update({ where: { id }, data: { status: "RECOVERED", recoveredAt: new Date() } });
      return NextResponse.json({ ok: true });
    case "reopen":
      await prisma.stolenGearReport.update({ where: { id }, data: { status: "PENDING_REVIEW", recoveredAt: null } });
      return NextResponse.json({ ok: true });
    case "notes":
      await prisma.stolenGearReport.update({
        where: { id },
        data: { adminNotes: (body.notes ?? "").slice(0, 4000) || null },
      });
      return NextResponse.json({ ok: true });
    default:
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }
}
