import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPhotographicEquipmentEquipmentDetail } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: RouteContext) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const { id } = await context.params;
  const numericId = Number.parseInt(id, 10);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const sourceParam = req.nextUrl.searchParams.get("source");
  const source =
    sourceParam === "legacy" || sourceParam === "body" ? sourceParam : undefined;

  const detail = await getPhotographicEquipmentEquipmentDetail(numericId, source);
  if (!detail) {
    return NextResponse.json({ error: "Equipo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
