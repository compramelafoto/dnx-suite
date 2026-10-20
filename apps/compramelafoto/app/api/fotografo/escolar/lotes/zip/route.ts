import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { archivosDelLote, cargarLibritos, resumenDelLote } from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import { MAX_LIBRITOS_POR_ZIP } from "@/lib/design-v2/produccion-reglas";
import { streamPrintExportZip } from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET ?lote=… o ?ids=… — ZIP con un PDF por librito, numerados en orden de impresión
 * («001 - 5º A - Alsina Justo.pdf»), más el resumen del lote. Se arma de a un archivo mientras
 * se descarga (ver `streamPrintExportZip`), así no se carga todo en memoria.
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const filtro = filtroDeLibritos({ ids: sp.get("ids") ?? undefined, lote: sp.get("lote") ?? undefined });
    const libros = await cargarLibritos(actor, filtro);
    if (libros.length === 0) return NextResponse.json({ error: "No hay librititos aprobados para descargar." }, { status: 400 });
    if (libros.length > MAX_LIBRITOS_POR_ZIP) {
      return NextResponse.json(
        { error: `Se pueden descargar hasta ${MAX_LIBRITOS_POR_ZIP} librititos juntos. Armá lotes más chicos (por curso).` },
        { status: 400 },
      );
    }
    const nombre = filtro.lote ?? `Librititos ${new Date().toISOString().slice(0, 10)}`;
    const archivos = archivosDelLote(libros);
    const sinArchivo = libros.filter((l) => !l.pdfKey);
    return streamPrintExportZip(
      [
        {
          folder: nombre,
          manifestHeader: [nombre, `${archivos.length} librititos`, ""],
          files: archivos.map((a) => ({
            zipPath: `${nombre}/${a.nombre}`,
            r2Key: a.r2Key,
            manifestLine: `OK      ${a.nombre}`,
            missingLine: `FALTA   ${a.nombre}`,
          })),
          pdfBytes: await resumenDelLote(nombre, libros),
          notes: sinArchivo.length
            ? [{ name: "SIN_PDF.txt", content: sinArchivo.map((l) => `${l.curso} ${l.alumno} (diseño ${l.id})`).join("\n") }]
            : [],
        },
      ],
      nombre,
    );
  } catch (err) {
    return respuestaDeError(err, "zip del lote");
  }
}
