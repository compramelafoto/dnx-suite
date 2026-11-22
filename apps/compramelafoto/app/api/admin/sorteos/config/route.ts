import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettingsForAdmin } from "@/lib/raffles/consultas";
import { parsePrizeTemplates } from "@/lib/raffles/mensajes";
import { requireRaffleAdmin } from "../_actor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** La configuración del sorteo mensual automático. */
export async function GET() {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return NextResponse.json({ settings: await getSettingsForAdmin() });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRaffleAdmin();
  if (!auth.ok) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const entero = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.trunc(Number(v));
    return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : def;
  };
  const excluidos = Array.isArray(b.excludedUserIds)
    ? [...new Set(b.excludedUserIds.map((x) => Math.trunc(Number(x))).filter((n) => Number.isFinite(n) && n > 0))]
    : [];
  const data = {
    monthlyEnabled: Boolean(b.monthlyEnabled),
    autoAnnounce: b.autoAnnounce === undefined ? true : Boolean(b.autoAnnounce),
    drawDay: entero(b.drawDay, 2, 28, 5),
    drawHour: entero(b.drawHour, 0, 23, 20),
    minSales: entero(b.minSales, 1, 1000, 1),
    monthlyPrizes: parsePrizeTemplates(b.monthlyPrizes),
    excludedUserIds: excluidos,
  };
  await prisma.clfRaffleSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });
  return NextResponse.json({ settings: await getSettingsForAdmin() });
}
