import { NextResponse } from "next/server";
import { requireSalesStaff } from "@/lib/sales/access";
import { archivoCarnet } from "@/lib/impresion/archivo-carnet";

export const dynamic = "force-dynamic";

/** La foto carnet sola (sin plancha), a 300 ppp. `?descargar=1` la baja como archivo. */
export async function GET(req: Request, { params }: { params: Promise<{ preparacionId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { preparacionId } = await params;
  const a = await archivoCarnet(workspace.id, preparacionId);
  if (!a) return new NextResponse(null, { status: 404 });
  const headers: Record<string, string> = { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store" };
  if (new URL(req.url).searchParams.get("descargar") === "1") headers["Content-Disposition"] = `attachment; filename="${a.nombre}"`;
  return new NextResponse(new Uint8Array(a.jpg), { headers });
}
