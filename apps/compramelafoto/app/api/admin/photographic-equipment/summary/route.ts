import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getPhotographicEquipmentSummary } from "@/lib/photographic-equipment/admin-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado. Se requiere rol ADMIN." }, { status: 403 });
  }

  const summary = await getPhotographicEquipmentSummary();
  return NextResponse.json(summary);
}
