import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { listPhotographicEquipmentPhotographers } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** @deprecated Usar /photographers — mantiene compatibilidad con clientes antiguos. */
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const result = await listPhotographicEquipmentPhotographers({
    search: params.get("search") ?? undefined,
    page: Number(params.get("page") ?? "1"),
    pageSize: Number(params.get("pageSize") ?? "30"),
  });

  return NextResponse.json({
    deprecated: true,
    message: "Usar GET /api/admin/photographic-equipment/photographers",
    photographers: result.photographers,
    pagination: result.pagination,
  });
}
