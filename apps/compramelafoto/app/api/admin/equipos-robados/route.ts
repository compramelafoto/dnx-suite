import { NextRequest, NextResponse } from "next/server";
import { getStolenGearAdminOverview, requireStolenGearAdmin, searchSerialHistory } from "@/lib/stolen-gear/admin";
import { scanStolenGear } from "@/lib/stolen-gear/scan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Panel admin: denuncias y coincidencias. Con ?serie=… devuelve el historial de esa serie. */
export async function GET(req: NextRequest) {
  const { denied } = await requireStolenGearAdmin();
  if (denied) return denied;
  const serie = req.nextUrl.searchParams.get("serie");
  if (serie != null) return NextResponse.json(await searchSerialHistory(serie.slice(0, 80)));
  return NextResponse.json(await getStolenGearAdminOverview());
}

/** "Buscar ahora": cruza todas las denuncias activas sin esperar al cruce diario. */
export async function POST() {
  const { denied } = await requireStolenGearAdmin();
  if (denied) return denied;
  const scan = await scanStolenGear();
  return NextResponse.json({ ok: true, ...scan });
}
