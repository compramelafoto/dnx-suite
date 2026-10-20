import { NextResponse } from "next/server";
import { requireSalesStaff } from "@/lib/sales/access";
import { leerObjeto } from "@/lib/impresion/almacen";
import { datosParaImprimir } from "@/lib/impresion/preparaciones";
import { nombreDescarga } from "@/lib/impresion/hoja-prueba";

export const dynamic = "force-dynamic";

/** El JPG final de una hoja, tal como se imprime. `?descargar=1` lo baja como archivo. */
export async function GET(req: Request, { params }: { params: Promise<{ hojaId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { hojaId } = await params;
  const d = await datosParaImprimir(workspace.id, hojaId);
  if (!d) return new NextResponse(null, { status: 404 });
  const buf = await leerObjeto(d.finalKey);
  const headers: Record<string, string> = { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" };
  if (new URL(req.url).searchParams.get("descargar") === "1") {
    headers["Content-Disposition"] = `attachment; filename="${nombreDescarga(d.salida, d.tamano, hojaId)}"`;
  }
  return new NextResponse(new Uint8Array(buf), { headers });
}
