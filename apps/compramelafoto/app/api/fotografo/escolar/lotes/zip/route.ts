import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import { zipDelLoteEscolar } from "@/lib/design-v2/zip-del-lote-escolar";
import { streamPrintExportZip } from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET ?lote=… o ?ids=…&copias=… [&formato=jpg] — ZIP del lote: una sola carpeta con todos los archivos,
 * que ordenados por nombre quedan en orden de impresión, más el resumen y el control («000 - …»).
 *
 * - PDF (por defecto): un PDF por trabajo, «001 - 7 A - Celoria Pedro (diseño 123).pdf».
 * - JPG: un JPG por cara, «001 - 7 A - Celoria Pedro (diseño 123) - 1 EXTERIOR (contratapa + tapa).jpg»,
 *   y un «000 - LEEME.txt» que explica el orden.
 *
 * Qué lleva lo arma `zipDelLoteEscolar` (lo mismo que muestra «Verificar lote»). Se arma de a un
 * archivo mientras se descarga (ver `streamPrintExportZip`), así no se carga todo en memoria. Los
 * JPG son los que se generaron al aprobar, con el mismo dibujo que el PDF: acá no se vuelve a
 * dibujar nada, sólo se les asegura la marca de 300 dpi (sin recomprimir).
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const formato = sp.get("formato") === "jpg" ? "jpg" : "pdf";
    const filtro = filtroDeLibritos({
      ids: sp.get("ids") ?? undefined,
      lote: sp.get("lote") ?? undefined,
      copias: sp.get("copias") ?? undefined,
    });
    const zip = await zipDelLoteEscolar(actor, filtro, formato);
    return streamPrintExportZip(zip.plans, zip.nombre);
  } catch (err) {
    return respuestaDeError(err, "zip del lote");
  }
}
