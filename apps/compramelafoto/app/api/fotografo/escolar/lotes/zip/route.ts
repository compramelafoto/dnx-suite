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
import {
  copiasDePedidosSinLibrito,
  copiasSueltasDelLote,
  lineaDeCopiasSueltas,
} from "@/lib/design-v2/copias-sueltas-del-lote";
import { cargarPedidosDeCopias, type PedidoDeCopias } from "@/lib/design-v2/copias-en-produccion";
import type { PrintExportFile } from "@/lib/orders/print-export/stream-print-export-zip";
import type { DesignActor } from "@/lib/design-v2/projects";

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
    const filtro = filtroDeLibritos({
      ids: sp.get("ids") ?? undefined,
      lote: sp.get("lote") ?? undefined,
      copias: sp.get("copias") ?? undefined,
    });
    const libros = filtro.ids || filtro.lote ? await cargarLibritos(actor, filtro) : [];
    // Pedidos de sólo copias impresas (sin librito): sus fotos van en «Copias sueltas».
    const pedidos = filtro.copias || filtro.lote ? await cargarPedidosDeCopias(actor, filtro) : [];
    if (libros.length === 0 && pedidos.length === 0) {
      return NextResponse.json({ error: "No hay nada aprobado para descargar." }, { status: 400 });
    }
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
    return formato === "jpg" ? await zipDeJpg(actor, nombre, libros, pedidos) : await zipDePdf(actor, nombre, libros, pedidos);
  } catch (err) {
    return respuestaDeError(err, "zip del lote");
  }
}

/** Las copias de los libritos y las de los pedidos sin librito, más la línea del control. */
async function todasLasCopias(actor: DesignActor, libros: LibritoParaProducir[], pedidos: PedidoDeCopias[], carpeta: string) {
  const deLibritos = await copiasSueltasDelLote(actor, libros, carpeta);
  const sinLibrito = await copiasDePedidosSinLibrito(actor, pedidos, libros.length + 1, libros.length + pedidos.length, carpeta);
  const lineas = [
    ...lineaDeCopiasSueltas(deLibritos),
    ...(pedidos.length
      ? [
          `${pedidos.length} ${pedidos.length === 1 ? "pedido" : "pedidos"} de solo copias impresas (sin librito), también en «Copias sueltas», numerados después de los libritos.`,
          "",
        ]
      : []),
  ];
  return { files: [...deLibritos, ...sinLibrito] as PrintExportFile[], lineas };
}

async function zipDePdf(actor: DesignActor, nombre: string, libros: LibritoParaProducir[], pedidos: PedidoDeCopias[]) {
  const archivos = archivosDelLote(libros);
  const carpeta = carpetaDelLote(nombre);
  const { files: copias, lineas } = await todasLasCopias(actor, libros, pedidos, carpeta);
  const sinArchivo = libros.flatMap((l, i) => (l.pdfKey ? [] : [nombreDeTrabajo(i + 1, l, libros.length)]));
  return streamPrintExportZip(
    [
      {
        folder: carpeta,
        manifestName: ARCHIVOS_DE_CONTROL.control,
        summaryName: ARCHIVOS_DE_CONTROL.resumen,
        manifestHeader: [nombre, `${archivos.length} librititos`, "", ...lineas],
        files: [
          ...archivos.map((a) => ({
            zipPath: `${carpeta}/${a.nombre}`,
            r2Key: a.r2Key,
            manifestLine: `OK      ${a.nombre}`,
            missingLine: `FALTA   ${a.nombre}`,
          })),
          ...copias,
        ],
        pdfBytes: await resumenDelLote(nombre, libros, pedidos),
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

async function zipDeJpg(actor: DesignActor, nombre: string, libros: LibritoParaProducir[], pedidos: PedidoDeCopias[]) {
  const plan = planDelLoteJpg(nombre, await conEtiquetasDeCaras(libros));
  const { files: copias, lineas } = await todasLasCopias(actor, libros, pedidos, plan.carpeta);
  const trabajos = libros.length - plan.faltantes.length;
  return streamPrintExportZip(
    [
      {
        folder: plan.carpeta,
        manifestName: ARCHIVOS_DE_CONTROL.control,
        summaryName: ARCHIVOS_DE_CONTROL.resumen,
        manifestHeader: [nombre, `${trabajos} trabajos · ${plan.archivos.length} JPG`, "", ...lineas],
        files: [
          ...plan.archivos.map((a) => ({
            zipPath: a.zipPath,
            r2Key: a.r2Key,
            manifestLine: `OK      ${a.nombre}`,
            missingLine: `FALTA   ${a.nombre}`,
            transform: (bytes: Buffer) => jpgConDensidad(bytes, 300),
          })),
          ...copias,
        ],
        pdfBytes: await resumenDelLote(nombre, libros, pedidos),
        notes: [
          {
            name: ARCHIVOS_DE_CONTROL.leeme,
            content: lineas.length ? `${plan.leeme}\r\n${lineas.filter(Boolean).join("\r\n")}\r\n` : plan.leeme,
          },
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
