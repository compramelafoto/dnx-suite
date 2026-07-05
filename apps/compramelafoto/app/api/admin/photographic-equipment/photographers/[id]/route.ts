import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPhotographicEquipmentPhotographerDetail } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const { id } = await context.params;
  const photographerId = Number.parseInt(id, 10);
  if (!Number.isFinite(photographerId)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const detail = await getPhotographicEquipmentPhotographerDetail(photographerId);
  if (!detail) {
    return NextResponse.json({ error: "Fotógrafo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
