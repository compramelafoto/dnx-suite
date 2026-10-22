import { NextRequest, NextResponse } from "next/server";
import { requireDesignActor } from "@/lib/design-v2/http";
import { jpgConDensidad } from "@/lib/design-v2/jpg-imprenta";
import {
  archivosDelLote,
  cargarLibritos,
  conEtiquetasDeCaras,
  resumenDelLote,
  type LibritoParaProducir,
} from "@/lib/design-v2/produccion";
import { filtroDeLibritos, respuestaDeError } from "@/lib/design-v2/produccion-http";
import {
  ARCHIVOS_DE_CONTROL,
  carpetaDelLote,
  MAX_LIBRITOS_POR_ZIP,
  MAX_LIBRITOS_POR_ZIP_JPG,
  nombreDeTrabajo,
  planDelLoteJpg,
} from "@/lib/design-v2/produccion-reglas";
import { streamPrintExportZip } from "@/lib/orders/print-export/stream-print-export-zip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET ?lote=… o ?ids=… [&formato=jpg] — ZIP del lote: una sola carpeta con todos los archivos,
 * que ordenados por nombre quedan en orden de impresión, más el resumen y el control («000 - …»).
 *
 * - PDF (por defecto): un PDF por trabajo, «001 - 7 A - Celoria Pedro (diseño 123).pdf».
 * - JPG: un JPG por cara, «001 - 7 A - Celoria Pedro (diseño 123) - 1 EXTERIOR (contratapa + tapa).jpg»,
 *   y un «000 - LEEME.txt» que explica el orden.
 *
 * Se arma de a un archivo mientras se descarga (ver `streamPrintExportZip`), así no se carga todo
 * en memoria. Los JPG son los que se generaron al aprobar, con el mismo dibujo que el PDF: acá no
 * se vuelve a dibujar nada, sólo se les asegura la marca de 300 dpi (sin recomprimir).
 */
export async function GET(req: NextRequest) {
  const actor = await requireDesignActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const sp = req.nextUrl.searchParams;
    const formato = sp.get("formato") === "jpg" ? "jpg" : "pdf";
    const filtro = filtroDeLibritos({ ids: sp.get("ids") ?? undefined, lote: sp.get("lote") ?? undefined });
    const libros = await cargarLibritos(actor, filtro);
    if (libros.length === 0) return NextResponse.json({ error: "No hay librititos aprobados para descargar." }, { status: 400 });
    const tope = formato === "jpg" ? MAX_LIBRITOS_POR_ZIP_JPG : MAX_LIBRITOS_POR_ZIP;
    if (libros.length > tope) {
      return NextResponse.json(
        {
          error:
            formato === "jpg"
              ? `El ZIP de JPG admite hasta ${tope} trabajos (pesa más que el de PDF). Armá lotes más chicos (por curso) o bajá el ZIP de PDF.`
              : `Se pueden descargar hasta ${tope} librititos juntos. Armá lotes más chicos (por curso).`,
        },
        { status: 400 },
      );
    }
    const nombre = filtro.lote ?? `Librititos ${new Date().toISOString().slice(0, 10)}`;
    return formato === "jpg" ? await zipDeJpg(nombre, libros) : await zipDePdf(nombre, libros);
  } catch (err) {
    return respuestaDeError(err, "zip del lote");
  }
}

async function zipDePdf(nombre: string, libros: LibritoParaProducir[]) {
  const archivos = archivosDelLote(libros);
  const carpeta = carpetaDelLote(nombre);
  const sinArchivo = libros.flatMap((l, i) => (l.pdfKey ? [] : [nombreDeTrabajo(i + 1, l, libros.length)]));
  return streamPrintExportZip(
    [
      {
        folder: carpeta,
        manifestName: ARCHIVOS_DE_CONTROL.control,
        summaryName: ARCHIVOS_DE_CONTROL.resumen,
        manifestHeader: [nombre, `${archivos.length} librititos`, ""],
        files: archivos.map((a) => ({
          zipPath: `${carpeta}/${a.nombre}`,
          r2Key: a.r2Key,
          manifestLine: `OK      ${a.nombre}`,
          missingLine: `FALTA   ${a.nombre}`,
        })),
        pdfBytes: await resumenDelLote(nombre, libros),
        notes: sinArchivo.length
          ? [
              {
                name: ARCHIVOS_DE_CONTROL.faltantes,
                content: `Estos trabajos no tienen su PDF final. Abrilos y tocá «Aprobar de nuevo».\r\n\r\n${sinArchivo.join("\r\n")}\r\n`,
              },
            ]
          : [],
      },
    ],
    nombre,
  );
}

async function zipDeJpg(nombre: string, libros: LibritoParaProducir[]) {
  const plan = planDelLoteJpg(nombre, await conEtiquetasDeCaras(libros));
  const trabajos = libros.length - plan.faltantes.length;
  return streamPrintExportZip(
    [
      {
        folder: plan.carpeta,
        manifestName: ARCHIVOS_DE_CONTROL.control,
        summaryName: ARCHIVOS_DE_CONTROL.resumen,
        manifestHeader: [nombre, `${trabajos} trabajos · ${plan.archivos.length} JPG`, ""],
        files: plan.archivos.map((a) => ({
          zipPath: a.zipPath,
          r2Key: a.r2Key,
          manifestLine: `OK      ${a.nombre}`,
          missingLine: `FALTA   ${a.nombre}`,
          transform: (bytes) => jpgConDensidad(bytes, 300),
        })),
        pdfBytes: await resumenDelLote(nombre, libros),
        notes: [
          { name: ARCHIVOS_DE_CONTROL.leeme, content: plan.leeme },
          ...(plan.faltantes.length
            ? [
                {
                  name: ARCHIVOS_DE_CONTROL.faltantes,
                  content: `Estos trabajos no tienen sus JPG finales. Abrilos y tocá «Aprobar de nuevo».\r\n\r\n${plan.faltantes.join("\r\n")}\r\n`,
                },
              ]
            : []),
        ],
      },
    ],
    `${nombre} - JPG`,
  );
}
