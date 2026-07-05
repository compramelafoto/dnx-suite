import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { listPhotographicEquipmentPhotographers } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const result = await listPhotographicEquipmentPhotographers({
    search: params.get("search") ?? undefined,
    page: Number(params.get("page") ?? "1"),
    pageSize: Number(params.get("pageSize") ?? "20"),
  });

  return NextResponse.json(result);
}
