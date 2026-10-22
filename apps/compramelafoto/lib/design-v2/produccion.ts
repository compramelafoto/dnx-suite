import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { readFromR2 } from "@/lib/r2-client";
import { urlToR2Key } from "@/lib/r2-public-url";
import { parseDesignV2Data } from "./design-data";
import type { DesignActor } from "./projects";
import {
  datosDelLibrito,
  nombreDeArchivo,
  nombreDelProximoLote,
  ordenDeImpresion,
  type LibritoConJpg,
  type LibritoEnProduccion,
} from "./produccion-reglas";

/**
 * Producción de los librititos aprobados: lotes de impresión, impresos y entregados.
 *
 * Cada diseño aprobado ya tiene su PDF final en R2 (lo arma `approveDesignProject`). Un lote no
 * vuelve a dibujar nada: junta esos archivos, en orden de impresión, y marca el paso.
 */

export type LibritoParaProducir = LibritoEnProduccion & {
  pdfKey: string | null;
  /** Un JPG por cara, generados al aprobar con el mismo dibujo que el PDF. */
  jpgKeys: string[];
  templateVersionId: string | null;
  printBatchName: string | null;
  sentToPrintAt: Date | null;
  printedAt: Date | null;
  deliveredAt: Date | null;
};

export class ProduccionError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

function propios(actor: DesignActor) {
  return actor.role === "ADMIN" ? {} : { photographerUserId: actor.id };
}

/** Los diseños aprobados del fotógrafo, con sus datos para nombrar archivos y etiquetas. */
export async function cargarLibritos(
  actor: DesignActor,
  filtro: { ids?: number[]; lote?: string },
): Promise<LibritoParaProducir[]> {
  if (!filtro.ids?.length && !filtro.lote) throw new ProduccionError("Elegí al menos un librito.");
  const rows = await prisma.designProject.findMany({
    where: {
      ...propios(actor),
      // Aprobado: «EXPORTED» cuando el PDF final se generó bien, «APPROVED_FOR_EXPORT» si falló.
      status: { in: ["APPROVED_FOR_EXPORT", "EXPORTED"] },
      ...(filtro.ids?.length ? { id: { in: filtro.ids } } : {}),
      ...(filtro.lote ? { printBatchName: filtro.lote } : {}),
    },
    select: {
      id: true,
      printBatchName: true,
      sentToPrintAt: true,
      printedAt: true,
      deliveredAt: true,
      currentRevision: { select: { dataJson: true } },
    },
    take: 2000,
  });
  const libros = rows.map((r) => {
    const data = parseDesignV2Data(r.currentRevision?.dataJson);
    const pdfUrl = data?.export?.pdfUrl ?? null;
    return {
      ...datosDelLibrito(r.id, data?.values),
      pdfKey: pdfUrl ? urlToR2Key(pdfUrl) : null,
      jpgKeys: (data?.export?.jpgUrls ?? []).map((u) => urlToR2Key(u)),
      templateVersionId: data?.templateV2VersionId || null,
      printBatchName: r.printBatchName,
      sentToPrintAt: r.sentToPrintAt,
      printedAt: r.printedAt,
      deliveredAt: r.deliveredAt,
    };
  });
  return ordenDeImpresion(libros);
}

/** Manda a imprimir: los agrupa en un lote nuevo con nombre «Lote N · fecha». */
export async function crearLote(actor: DesignActor, ids: number[]): Promise<{ nombre: string; cantidad: number }> {
  const libros = await cargarLibritos(actor, { ids });
  const sinArchivo = libros.filter((l) => !l.pdfKey);
  if (libros.length === 0) throw new ProduccionError("Ninguno de los elegidos está aprobado.");
  if (sinArchivo.length > 0) {
    throw new ProduccionError(
      `${sinArchivo.length} librito(s) no tienen su PDF final todavía. Abrilos y tocá «Aprobar de nuevo».`,
    );
  }
  const existentes = await prisma.designProject.findMany({
    where: { ...propios(actor), printBatchName: { not: null } },
    distinct: ["printBatchName"],
    select: { printBatchName: true },
  });
  const nombre = nombreDelProximoLote(
    existentes.map((e) => e.printBatchName!).filter(Boolean),
    new Date(),
  );
  const r = await prisma.designProject.updateMany({
    where: { id: { in: libros.map((l) => l.id) }, ...propios(actor) },
    data: { printBatchName: nombre, sentToPrintAt: new Date(), printedAt: null, deliveredAt: null },
  });
  return { nombre, cantidad: r.count };
}

export type PasoDeProduccion = "IMPRESO" | "ENTREGADO" | "VOLVER_A_IMPRIMIR";

/** Marca un paso para los elegidos o para un lote entero. */
export async function marcarPaso(
  actor: DesignActor,
  filtro: { ids?: number[]; lote?: string },
  paso: PasoDeProduccion,
): Promise<number> {
  const libros = await cargarLibritos(actor, filtro);
  const ids = libros.map((l) => l.id);
  if (ids.length === 0) return 0;
  const ahora = new Date();
  const data =
    paso === "IMPRESO"
      ? { printedAt: ahora }
      : paso === "ENTREGADO"
        ? { deliveredAt: ahora, printedAt: undefined }
        : { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null };
  const r = await prisma.designProject.updateMany({ where: { id: { in: ids }, ...propios(actor) }, data });
  // Entregar sin haber marcado impreso: se da por impreso en el mismo momento.
  if (paso === "ENTREGADO") {
    await prisma.designProject.updateMany({
      where: { id: { in: ids }, ...propios(actor), printedAt: null },
      data: { printedAt: ahora },
    });
  }
  return r.count;
}

export type ResumenDeLote = {
  nombre: string;
  cantidad: number;
  enviadoAt: Date | null;
  impresos: number;
  entregados: number;
};

export async function listarLotes(actor: DesignActor): Promise<ResumenDeLote[]> {
  const rows = await prisma.designProject.findMany({
    where: { ...propios(actor), printBatchName: { not: null } },
    select: { printBatchName: true, sentToPrintAt: true, printedAt: true, deliveredAt: true },
  });
  const porLote = new Map<string, ResumenDeLote>();
  for (const r of rows) {
    const nombre = r.printBatchName!;
    const l = porLote.get(nombre) ?? { nombre, cantidad: 0, enviadoAt: r.sentToPrintAt, impresos: 0, entregados: 0 };
    l.cantidad++;
    if (r.printedAt) l.impresos++;
    if (r.deliveredAt) l.entregados++;
    if (r.sentToPrintAt && (!l.enviadoAt || r.sentToPrintAt < l.enviadoAt)) l.enviadoAt = r.sentToPrintAt;
    porLote.set(nombre, l);
  }
  return [...porLote.values()].sort((a, b) => (b.enviadoAt?.getTime() ?? 0) - (a.enviadoAt?.getTime() ?? 0));
}

/**
 * Los archivos del ZIP, en orden de impresión. El número es el lugar en la lista completa, igual
 * que en el resumen y las etiquetas: si falta uno, los demás no se corren.
 */
export function archivosDelLote(libros: LibritoParaProducir[]) {
  return libros.flatMap((l, i) =>
    l.pdfKey ? [{ libro: l, nombre: nombreDeArchivo(i + 1, l, libros.length), r2Key: l.pdfKey }] : [],
  );
}

/** Los librititos con las etiquetas de sus caras («Exterior (contratapa + tapa)», «Interior»). */
export async function conEtiquetasDeCaras(libros: LibritoParaProducir[]): Promise<LibritoConJpg[]> {
  const ids = [...new Set(libros.map((l) => l.templateVersionId).filter((v): v is string => !!v))];
  const versiones = ids.length
    ? await prisma.templateV2Version.findMany({ where: { id: { in: ids } }, select: { id: true, metaJson: true } })
    : [];
  const porVersion = new Map(versiones.map((v) => [v.id, etiquetasDeCaras(v.metaJson)]));
  return libros.map((l) => ({ ...l, etiquetas: (l.templateVersionId && porVersion.get(l.templateVersionId)) || null }));
}

/** `metaJson.pageLabels` de una versión de plantilla, o null si no tiene. */
export function etiquetasDeCaras(metaJson: unknown): string[] | null {
  const meta = metaJson && typeof metaJson === "object" ? (metaJson as { pageLabels?: unknown }) : {};
  return Array.isArray(meta.pageLabels) ? meta.pageLabels.map((x) => (typeof x === "string" ? x : "")) : null;
}

/** Todos los librititos en un único PDF, uno detrás del otro, para mandar a la imprenta. */
export async function pdfUnico(libros: LibritoParaProducir[]): Promise<{ bytes: Uint8Array; faltantes: string[] }> {
  const salida = await PDFDocument.create();
  const faltantes: string[] = [];
  for (const l of libros) {
    if (!l.pdfKey) {
      faltantes.push(`${l.curso} ${l.alumno} (diseño ${l.id}): sin PDF final`);
      continue;
    }
    try {
      const doc = await PDFDocument.load(await readFromR2(l.pdfKey));
      const paginas = await salida.copyPages(doc, doc.getPageIndices());
      for (const p of paginas) salida.addPage(p);
    } catch (err) {
      console.error("[produccion] no se pudo sumar al PDF único", l.id, err);
      faltantes.push(`${l.curso} ${l.alumno} (diseño ${l.id}): no se pudo leer`);
    }
  }
  return { bytes: await salida.save(), faltantes };
}

/** Resumen del lote en PDF: qué librito va en qué número, para controlar al recibirlos. */
export async function resumenDelLote(nombre: string, libros: LibritoParaProducir[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");
  let page = doc.addPage([595, 842]);
  let y = 800;
  page.drawText(limpio(nombre), { x: 40, y, size: 16, font: bold });
  y -= 22;
  page.drawText(`${libros.length} libritos`, { x: 40, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 24;
  const ancho = Math.max(3, String(libros.length).length);
  libros.forEach((l, i) => {
    if (y < 50) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    // Mismo número y mismo id que en los nombres de los archivos del ZIP.
    const linea = `${String(i + 1).padStart(ancho, "0")}   ${limpio(l.curso)}   ${limpio(l.alumno)}   (diseno ${l.id})`;
    page.drawText(linea, { x: 40, y, size: 10, font });
    y -= 15;
  });
  return doc.save();
}

/** Etiquetas para los sobres: A4, 3 columnas × 8 filas, alumno grande y curso/colegio abajo. */
export async function etiquetas(libros: LibritoParaProducir[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");
  const cols = 3;
  const filas = 8;
  const margen = 20;
  const ancho = (595 - margen * 2) / cols;
  const alto = (842 - margen * 2) / filas;
  const ajustar = (texto: string, f: typeof font, tam: number, max: number) => {
    let size = tam;
    while (size > 6 && f.widthOfTextAtSize(texto, size) > max) size -= 0.5;
    return size;
  };
  libros.forEach((l, i) => {
    const enHoja = i % (cols * filas);
    if (enHoja === 0) doc.addPage([595, 842]);
    const page = doc.getPages()[doc.getPageCount() - 1]!;
    const c = enHoja % cols;
    const f = Math.floor(enHoja / cols);
    const x = margen + c * ancho;
    const yTop = 842 - margen - f * alto;
    page.drawRectangle({ x: x + 3, y: yTop - alto + 3, width: ancho - 6, height: alto - 6, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
    const alumno = limpio(l.alumno) || `Diseno ${l.id}`;
    const s1 = ajustar(alumno, bold, 13, ancho - 20);
    page.drawText(alumno, { x: x + 10, y: yTop - 30, size: s1, font: bold });
    const curso = limpio(l.curso);
    if (curso) page.drawText(curso, { x: x + 10, y: yTop - 48, size: ajustar(curso, font, 11, ancho - 20), font });
    const colegio = limpio(l.colegio);
    if (colegio) {
      page.drawText(colegio, { x: x + 10, y: yTop - 64, size: ajustar(colegio, font, 9, ancho - 20), font, color: rgb(0.35, 0.35, 0.35) });
    }
    page.drawText(`#${l.id}`, { x: x + ancho - 40, y: yTop - alto + 12, size: 7, font, color: rgb(0.55, 0.55, 0.55) });
  });
  if (doc.getPageCount() === 0) doc.addPage([595, 842]);
  return doc.save();
}
