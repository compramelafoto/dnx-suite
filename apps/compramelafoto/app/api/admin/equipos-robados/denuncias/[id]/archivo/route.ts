import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSignedUrlForFile } from "@/lib/r2-client";
import { requireStolenGearAdmin } from "@/lib/stolen-gear/admin";
import { bucketOverrideForKey } from "@/lib/stolen-gear/bucket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Abre la factura o la denuncia policial con un link firmado de 10 minutos. Sólo admin. */
export async function GET(req: NextRequest, context: RouteContext) {
  const { denied } = await requireStolenGearAdmin();
  if (denied) return denied;
  const id = Number((await context.params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  const which = req.nextUrl.searchParams.get("cual") === "denuncia" ? "denuncia" : "factura";
  const report = await prisma.stolenGearReport.findUnique({
    where: { id },
    select: { invoiceKey: true, policeReportKey: true },
  });
  const key = which === "denuncia" ? report?.policeReportKey : report?.invoiceKey;
  if (!key) return NextResponse.json({ error: "No hay archivo" }, { status: 404 });
  const url = await getSignedUrlForFile(key, 600, bucketOverrideForKey(key));
  return NextResponse.redirect(url);
}
