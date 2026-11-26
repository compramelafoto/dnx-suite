import "server-only";
import { jpgConDensidad } from "./jpg-imprenta";
import {
  archivosDelLote,
  cargarLibritos,
  conEtiquetasDeCaras,
  ProduccionError,
  resumenDelLote,
  type LibritoParaProducir,
} from "./produccion";
import {
  ARCHIVOS_DE_CONTROL,
  carpetaDelLote,
  MAX_LIBRITOS_POR_ZIP,
  MAX_LIBRITOS_POR_ZIP_JPG,
  nombreDeTrabajo,
  planDelLoteJpg,
} from "./produccion-reglas";
import { copiasDePedidosSinLibrito, copiasSueltasDelLote, lineaDeCopiasSueltas } from "./copias-sueltas-del-lote";
import { cargarPedidosDeCopias, type PedidoDeCopias } from "./copias-en-produccion";
import type { PrintExportFile, PrintExportPlan } from "@/lib/orders/print-export/stream-print-export-zip";
import type { DesignActor } from "./projects";

/**
 * Lo que lleva el ZIP de un lote escolar (PDF o JPG): una sola carpeta con todos los archivos,
 * que ordenados por nombre quedan en orden de impresión, más el resumen y el control («000 - …»).
 * Lo usan la descarga (`/api/fotografo/escolar/lotes/zip`) y «Verificar lote», así las dos
 * muestran exactamente lo mismo.
 */

export type FormatoDelZip = "pdf" | "jpg";

export type ZipDelLoteEscolar = {
  /** Nombre del ZIP sin «.zip». */
  nombre: string;
  plans: PrintExportPlan[];
  /** Los archivos de control que también van en el ZIP. */
  control: string[];
};

const librito = (l: LibritoParaProducir) => [l.colegio, l.curso, l.alumno].filter(Boolean).join(" · ");

export async function zipDelLoteEscolar(
  actor: DesignActor,
  filtro: { ids?: number[]; lote?: string; copias?: number[] },
  formato: FormatoDelZip,
  /** Sin el PDF de resumen: «Verificar lote» no lo necesita y es lo que más tarda. */
  { conResumen = true }: { conResumen?: boolean } = {},
): Promise<ZipDelLoteEscolar> {
  const libros = filtro.ids || filtro.lote ? await cargarLibritos(actor, filtro) : [];
  // Pedidos de sólo copias impresas (sin librito): sus fotos van en «Copias sueltas».
  const pedidos = filtro.copias || filtro.lote ? await cargarPedidosDeCopias(actor, filtro) : [];
  if (libros.length === 0 && pedidos.length === 0) throw new ProduccionError("No hay nada aprobado para descargar.");
  const tope = formato === "jpg" ? MAX_LIBRITOS_POR_ZIP_JPG : MAX_LIBRITOS_POR_ZIP;
  if (libros.length > tope) {
    throw new ProduccionError(
      formato === "jpg"
        ? `El ZIP de JPG admite hasta ${tope} trabajos (pesa más que el de PDF). Armá lotes más chicos (por curso) o bajá el ZIP de PDF.`
        : `Se pueden descargar hasta ${tope} librititos juntos. Armá lotes más chicos (por curso).`,
    );
  }
  const nombre = filtro.lote ?? `Librititos ${new Date().toISOString().slice(0, 10)}`;
  const resumen = conResumen ? await resumenDelLote(nombre, libros, pedidos) : new Uint8Array();
  return formato === "jpg"
    ? zipDeJpg(actor, nombre, libros, pedidos, resumen)
    : zipDePdf(actor, nombre, libros, pedidos, resumen);
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

async function zipDePdf(
  actor: DesignActor,
  nombre: string,
  libros: LibritoParaProducir[],
  pedidos: PedidoDeCopias[],
  resumen: Uint8Array,
): Promise<ZipDelLoteEscolar> {
  const archivos = archivosDelLote(libros);
  const carpeta = carpetaDelLote(nombre);
  const { files: copias, lineas } = await todasLasCopias(actor, libros, pedidos, carpeta);
  const sinArchivo = libros.flatMap((l, i) => (l.pdfKey ? [] : [nombreDeTrabajo(i + 1, l, libros.length)]));
  return {
    nombre,
    control: [
      ARCHIVOS_DE_CONTROL.resumen,
      ARCHIVOS_DE_CONTROL.control,
      ...(sinArchivo.length ? [ARCHIVOS_DE_CONTROL.faltantes] : []),
    ],
    plans: [
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
            vistaPrevia: a.libro.jpgKeys,
            detalle: `Librito · ${librito(a.libro)}`,
          })),
          ...copias,
        ],
        pdfBytes: resumen,
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
  };
}

async function zipDeJpg(
  actor: DesignActor,
  nombre: string,
  libros: LibritoParaProducir[],
  pedidos: PedidoDeCopias[],
  resumen: Uint8Array,
): Promise<ZipDelLoteEscolar> {
  const conCaras = await conEtiquetasDeCaras(libros);
  const plan = planDelLoteJpg(nombre, conCaras);
  const { files: copias, lineas } = await todasLasCopias(actor, libros, pedidos, plan.carpeta);
  const trabajos = libros.length - plan.faltantes.length;
  // De qué librito es cada JPG (para «Verificar lote»): el plan los arma en orden, cara por cara.
  const deQuien = new Map(libros.flatMap((l) => l.jpgKeys.map((k) => [k, l] as const)));
  return {
    nombre: `${nombre} - JPG`,
    control: [
      ARCHIVOS_DE_CONTROL.leeme,
      ARCHIVOS_DE_CONTROL.resumen,
      ARCHIVOS_DE_CONTROL.control,
      ...(plan.faltantes.length ? [ARCHIVOS_DE_CONTROL.faltantes] : []),
    ],
    plans: [
      {
        folder: plan.carpeta,
        manifestName: ARCHIVOS_DE_CONTROL.control,
        summaryName: ARCHIVOS_DE_CONTROL.resumen,
        manifestHeader: [nombre, `${trabajos} trabajos · ${plan.archivos.length} JPG`, "", ...lineas],
        files: [
          ...plan.archivos.map((a) => {
            const l = deQuien.get(a.r2Key);
            return {
              zipPath: a.zipPath,
              r2Key: a.r2Key,
              manifestLine: `OK      ${a.nombre}`,
              missingLine: `FALTA   ${a.nombre}`,
              transform: (bytes: Buffer) => jpgConDensidad(bytes, 300),
              ...(l ? { detalle: `Librito (una cara) · ${librito(l)}` } : {}),
            };
          }),
          ...copias,
        ],
        pdfBytes: resumen,
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
  };
}
