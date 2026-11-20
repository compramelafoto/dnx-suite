import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { prisma, type Prisma } from "@/lib/prisma";
import { ensureFulfillmentQrTokenForPreCompraOrderItem } from "@/lib/school-fulfillment/ensure-fulfillment-qr-token";
import { baseAppUrl, urlDeEntregaEscolar } from "@/lib/school-fulfillment/entrega-url";
import { readFromR2 } from "@/lib/r2-client";
import { urlToR2Key } from "@/lib/r2-public-url";
import { parseDesignV2Data } from "./design-data";
import {
  actualizarCopias,
  avancesDeCopiasEnLotes,
  cargarPedidosDeCopias,
  mandarCopiasAImprimir,
  type PedidoDeCopias,
} from "./copias-en-produccion";
import type { DesignActor } from "./projects";
import {
  datosDelLibrito,
  geometriaDeEtiqueta,
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
  /** Ítem de la preventa al que corresponde; null si el pack se pagó por fuera (solo `albumOrderId`). */
  preCompraItemId: number | null;
  /** Código del QR de entrega (`/escolar/entrega/[token]`); null si todavía no tiene o no hay ítem. */
  qrToken: string | null;
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
      orderItemId: true,
      orderItem: { select: { fulfillmentQrToken: true } },
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
      preCompraItemId: r.orderItemId,
      qrToken: r.orderItem?.fulfillmentQrToken || null,
    };
  });
  return ordenDeImpresion(libros);
}

/**
 * Les da su código de entrega a los librititos de la preventa que todavía no lo tienen (se guarda en
 * el ítem, así el QR es siempre el mismo). Los que no vienen de la preventa quedan sin QR.
 */
export async function conCodigoDeEntrega(libros: LibritoParaProducir[]): Promise<LibritoParaProducir[]> {
  const salida: LibritoParaProducir[] = [];
  for (const l of libros) {
    if (l.qrToken || l.preCompraItemId == null) {
      salida.push(l);
      continue;
    }
    const { token } = await ensureFulfillmentQrTokenForPreCompraOrderItem(prisma, l.preCompraItemId);
    salida.push({ ...l, qrToken: token });
  }
  return salida;
}

/**
 * Manda a imprimir: los agrupa en un lote nuevo con nombre «Lote N · fecha». Además de los
 * libritos (`ids`), entran los pedidos de sólo copias (`copias`, ids de pedido de canje).
 */
export async function crearLote(
  actor: DesignActor,
  ids: number[],
  copias: number[] = [],
): Promise<{ nombre: string; cantidad: number }> {
  const libros = ids.length ? await cargarLibritos(actor, { ids }) : [];
  const pedidosDeCopias = copias.length ? await cargarPedidosDeCopias(actor, { copias }) : [];
  const sinArchivo = libros.filter((l) => !l.pdfKey);
  if (libros.length === 0 && pedidosDeCopias.length === 0) {
    throw new ProduccionError("Ninguno de los elegidos está listo para imprimir.");
  }
  if (sinArchivo.length > 0) {
    throw new ProduccionError(
      `${sinArchivo.length} librito(s) no tienen su PDF final todavía. Abrilos y tocá «Aprobar de nuevo».`,
    );
  }
  const [existentes, deCopias] = await Promise.all([
    prisma.designProject.findMany({
      where: { ...propios(actor), printBatchName: { not: null } },
      distinct: ["printBatchName"],
      select: { printBatchName: true },
    }),
    avancesDeCopiasEnLotes(actor),
  ]);
  const ahora = new Date();
  const nombre = nombreDelProximoLote(
    [...existentes.map((e) => e.printBatchName!), ...deCopias.map((c) => c.printBatchName!)].filter(Boolean),
    ahora,
  );
  const r = libros.length
    ? await prisma.designProject.updateMany({
        where: { id: { in: libros.map((l) => l.id) }, ...propios(actor) },
        data: { printBatchName: nombre, sentToPrintAt: ahora, printedAt: null, deliveredAt: null },
      })
    : { count: 0 };
  const c = await mandarCopiasAImprimir(actor, pedidosDeCopias, nombre, ahora);
  return { nombre, cantidad: r.count + c };
}

export type PasoDeProduccion = "IMPRESO" | "ENTREGADO" | "VOLVER_A_IMPRIMIR";

/**
 * Marca un paso para los elegidos o para un lote entero. `ids` son libritos y `copias` pedidos de
 * sólo copias; con `lote` van los dos.
 */
export async function marcarPaso(
  actor: DesignActor,
  filtro: { ids?: number[]; lote?: string; copias?: number[] },
  paso: PasoDeProduccion,
): Promise<number> {
  const libros = filtro.ids?.length || filtro.lote ? await cargarLibritos(actor, filtro) : [];
  const ids = libros.map((l) => l.id);
  const pedidos =
    filtro.copias?.length || filtro.lote
      ? (await cargarPedidosDeCopias(actor, { copias: filtro.copias, lote: filtro.lote })).filter((p) => p.sentToPrintAt)
      : [];
  const ordenes = pedidos.map((p) => p.orderId);
  const ahora = new Date();
  let total = 0;
  if (ids.length) {
    const data =
      paso === "IMPRESO"
        ? { printedAt: ahora }
        : paso === "ENTREGADO"
          ? { deliveredAt: ahora, printedAt: undefined }
          : { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null };
    const r = await prisma.designProject.updateMany({ where: { id: { in: ids }, ...propios(actor) }, data });
    total += r.count;
    // Entregar sin haber marcado impreso: se da por impreso en el mismo momento.
    if (paso === "ENTREGADO") {
      await prisma.designProject.updateMany({
        where: { id: { in: ids }, ...propios(actor), printedAt: null },
        data: { printedAt: ahora },
      });
    }
  }
  if (ordenes.length) {
    if (paso === "IMPRESO") total += await actualizarCopias(ordenes, { printedAt: ahora });
    else if (paso === "ENTREGADO") {
      total += await actualizarCopias(ordenes, { deliveredAt: ahora });
      await actualizarCopias(ordenes, { printedAt: ahora }, { printedAt: null });
    } else {
      total += await actualizarCopias(ordenes, { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null });
    }
  }
  return total;
}

/** Pasos desde los que se puede volver uno atrás. */
export const PASOS_CON_VUELTA = ["CAMBIOS_PEDIDOS", "PARA_IMPRIMIR", "EN_IMPRENTA", "PARA_ENTREGAR", "ENTREGADO"] as const;
export type PasoConVuelta = (typeof PASOS_CON_VUELTA)[number];

/**
 * Lleva las piezas elegidas que están en `desde` al paso anterior. Sólo mueve las que están en ese
 * paso: si un pedido tiene un librito más adelantado, ése queda donde está.
 *
 * - Cambios pedidos → Revisar diseño: se retira el pedido de cambios (vuelve a esperar tu revisión).
 * - Para imprimir → Revisar diseño: se des-aprueba el librito. Al aprobarlo de nuevo se rehace el
 *   PDF. Los pedidos de sólo copias no tienen paso anterior (sería deshacer el canje).
 * - En imprenta → Para imprimir: sale del lote (lo mismo que «Sacar del lote»).
 * - Para entregar → En imprenta: se borra la marca de impreso.
 * - Entregado → Para entregar: se borra la marca de entregado.
 *
 * No manda correos. `items` son ítems de la tienda escolar, que llevan su propio estado físico
 * (PHYSICAL_IN_PROGRESS → AT_SCHOOL → DELIVERED) además de las fechas del librito.
 */
export async function volverUnPaso(
  actor: DesignActor,
  desde: PasoConVuelta,
  piezas: { disenos?: number[]; copias?: number[]; items?: number[] },
): Promise<number> {
  const disenos = piezas.disenos ?? [];
  const copias = piezas.copias ?? [];
  const items = piezas.items ?? [];
  const deDisenos = (extra: Prisma.DesignProjectWhereInput): Prisma.DesignProjectWhereInput => ({
    id: { in: disenos },
    ...propios(actor),
    ...extra,
  });
  const aprobado = { in: ["APPROVED_FOR_EXPORT", "EXPORTED"] };
  let total = 0;

  if (desde === "CAMBIOS_PEDIDOS" || desde === "PARA_IMPRIMIR") {
    if (disenos.length === 0) return 0;
    const where =
      desde === "CAMBIOS_PEDIDOS"
        ? deDisenos({ status: "NEEDS_ADJUSTMENT" })
        : deDisenos({ status: aprobado, sentToPrintAt: null });
    const afectados = await prisma.designProject.findMany({ where, select: { id: true, orderItemId: true } });
    if (afectados.length === 0) return 0;
    const r = await prisma.designProject.updateMany({
      where: { id: { in: afectados.map((d) => d.id) } },
      data:
        desde === "CAMBIOS_PEDIDOS"
          ? { status: "PENDING_PHOTOGRAPHER_APPROVAL" }
          : { status: "PENDING_PHOTOGRAPHER_APPROVAL", approvedAt: null, approvedByUserId: null },
    });
    // El ítem de la tienda lo había pasado a EXPORTED la aprobación: vuelve a «diseño enviado».
    const deTienda = afectados.map((d) => d.orderItemId).filter((v): v is number => v != null);
    if (desde === "PARA_IMPRIMIR" && deTienda.length) {
      await prisma.preCompraOrderItem.updateMany({
        where: { id: { in: deTienda }, status: { in: ["APPROVED", "EXPORTED"] } },
        data: { status: "DESIGN_SUBMITTED" },
      });
    }
    return r.count;
  }

  const ahoraDisenos =
    desde === "EN_IMPRENTA"
      ? {
          where: deDisenos({ status: aprobado, sentToPrintAt: { not: null }, printedAt: null }),
          data: { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null },
        }
      : desde === "PARA_ENTREGAR"
        ? { where: deDisenos({ status: aprobado, printedAt: { not: null }, deliveredAt: null }), data: { printedAt: null } }
        : { where: deDisenos({ status: aprobado, deliveredAt: { not: null } }), data: { deliveredAt: null } };
  if (disenos.length) total += (await prisma.designProject.updateMany(ahoraDisenos)).count;

  if (copias.length) {
    const propiosDeCopias = (await cargarPedidosDeCopias(actor, { copias })).map((p) => p.orderId);
    total +=
      desde === "EN_IMPRENTA"
        ? await actualizarCopias(
            propiosDeCopias,
            { printBatchName: null, sentToPrintAt: null, printedAt: null, deliveredAt: null },
            { sentToPrintAt: { not: null }, printedAt: null },
          )
        : desde === "PARA_ENTREGAR"
          ? await actualizarCopias(propiosDeCopias, { printedAt: null }, { printedAt: { not: null }, deliveredAt: null })
          : await actualizarCopias(propiosDeCopias, { deliveredAt: null }, { deliveredAt: { not: null } });
  }

  if (items.length) {
    const [antes, despues] =
      desde === "EN_IMPRENTA"
        ? (["PHYSICAL_IN_PROGRESS", "EXPORTED"] as const)
        : desde === "PARA_ENTREGAR"
          ? (["AT_SCHOOL", "PHYSICAL_IN_PROGRESS"] as const)
          : (["DELIVERED", "AT_SCHOOL"] as const);
    const r = await prisma.preCompraOrderItem.updateMany({
      where: {
        id: { in: items },
        status: antes,
        ...(actor.role === "ADMIN" ? {} : { order: { album: { userId: actor.id } } }),
      },
      data: { status: despues },
    });
    total += r.count;
  }
  return total;
}

export type ResumenDeLote = {
  nombre: string;
  /** Trabajos del lote: libritos más pedidos de sólo copias. */
  cantidad: number;
  libritos: number;
  /** Pedidos de sólo copias impresas (sin librito). */
  copias: number;
  enviadoAt: Date | null;
  impresos: number;
  entregados: number;
};

export async function listarLotes(actor: DesignActor): Promise<ResumenDeLote[]> {
  const [rows, deCopias] = await Promise.all([
    prisma.designProject.findMany({
      where: { ...propios(actor), printBatchName: { not: null } },
      select: { printBatchName: true, sentToPrintAt: true, printedAt: true, deliveredAt: true },
    }),
    avancesDeCopiasEnLotes(actor),
  ]);
  const porLote = new Map<string, ResumenDeLote>();
  const sumar = (r: (typeof rows)[number], tipo: "libritos" | "copias") => {
    const nombre = r.printBatchName!;
    const l =
      porLote.get(nombre) ??
      { nombre, cantidad: 0, libritos: 0, copias: 0, enviadoAt: r.sentToPrintAt, impresos: 0, entregados: 0 };
    l.cantidad++;
    l[tipo]++;
    if (r.printedAt) l.impresos++;
    if (r.deliveredAt) l.entregados++;
    if (r.sentToPrintAt && (!l.enviadoAt || r.sentToPrintAt < l.enviadoAt)) l.enviadoAt = r.sentToPrintAt;
    porLote.set(nombre, l);
  };
  for (const r of rows) sumar(r, "libritos");
  for (const r of deCopias) sumar(r, "copias");
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
export async function resumenDelLote(
  nombre: string,
  libros: LibritoParaProducir[],
  pedidosDeCopias: PedidoDeCopias[] = [],
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");
  let page = doc.addPage([595, 842]);
  let y = 800;
  page.drawText(limpio(nombre), { x: 40, y, size: 16, font: bold });
  y -= 22;
  const conteo = pedidosDeCopias.length
    ? `${libros.length} libritos · ${pedidosDeCopias.length} pedidos de solo copias`
    : `${libros.length} libritos`;
  page.drawText(conteo, { x: 40, y, size: 10, font, color: rgb(0.35, 0.35, 0.35) });
  y -= 24;
  const total = libros.length + pedidosDeCopias.length;
  const ancho = Math.max(3, String(total).length);
  const renglon = (texto: string) => {
    if (y < 50) {
      page = doc.addPage([595, 842]);
      y = 800;
    }
    page.drawText(texto, { x: 40, y, size: 10, font });
    y -= 15;
  };
  // Mismo número y mismo id que en los nombres de los archivos del ZIP. Los pedidos de sólo copias
  // van después de los libritos, con el número del pedido.
  libros.forEach((l, i) =>
    renglon(`${String(i + 1).padStart(ancho, "0")}   ${limpio(l.curso)}   ${limpio(l.alumno)}   (diseno ${l.id})`),
  );
  pedidosDeCopias.forEach((p, i) =>
    renglon(
      `${String(libros.length + i + 1).padStart(ancho, "0")}   ${limpio(p.curso)}   ${limpio(p.alumno)}   (solo copias, pedido ${p.orderId})`,
    ),
  );
  return doc.save();
}

/**
 * Etiquetas para los sobres: A4, 3 columnas × 8 filas, alumno grande y curso/colegio abajo. Si el
 * librito tiene código de entrega, lleva el QR (~2 cm) a la derecha, que abre la ficha de entrega.
 */
export async function etiquetas(
  libros: Array<Pick<LibritoParaProducir, "id" | "alumno" | "curso" | "colegio" | "qrToken">>,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const limpio = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "");
  const cols = 3;
  const filas = 8;
  const margen = 20;
  const ancho = (595 - margen * 2) / cols;
  const alto = (842 - margen * 2) / filas;
  const baseUrl = baseAppUrl();
  /** Achica la letra hasta que entre; si ni en 6 pt entra, lo corta con «...» para no pisar el QR. */
  const ajustar = (texto: string, f: typeof font, tam: number, max: number) => {
    let size = tam;
    while (size > 6 && f.widthOfTextAtSize(texto, size) > max) size -= 0.5;
    let t = texto;
    if (f.widthOfTextAtSize(t, size) > max) {
      while (t.length > 0 && f.widthOfTextAtSize(`${t}...`, size) > max) t = t.slice(0, -1);
      t = `${t.trimEnd()}...`;
    }
    return { t, size };
  };
  for (const [i, l] of libros.entries()) {
    const enHoja = i % (cols * filas);
    if (enHoja === 0) doc.addPage([595, 842]);
    const page = doc.getPages()[doc.getPageCount() - 1]!;
    const c = enHoja % cols;
    const f = Math.floor(enHoja / cols);
    const x = margen + c * ancho;
    const yTop = 842 - margen - f * alto;
    const yBase = yTop - alto;
    const g = geometriaDeEtiqueta(ancho, alto, Boolean(l.qrToken));
    page.drawRectangle({ x: x + 3, y: yBase + 3, width: ancho - 6, height: alto - 6, borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 0.5 });
    const linea = (texto: string, f: typeof font, tam: number, y: number, color?: ReturnType<typeof rgb>) => {
      const a = ajustar(texto, f, tam, g.textoMax);
      page.drawText(a.t, { x: x + g.textoX, y, size: a.size, font: f, color });
    };
    linea(limpio(l.alumno) || `Diseno ${l.id}`, bold, 13, yTop - 30);
    const curso = limpio(l.curso);
    if (curso) linea(curso, font, 11, yTop - 48);
    const colegio = limpio(l.colegio);
    if (colegio) linea(colegio, font, 9, yTop - 64, rgb(0.35, 0.35, 0.35));
    page.drawText(`#${l.id}`, { x: x + g.id.x, y: yBase + g.id.y, size: 7, font, color: rgb(0.55, 0.55, 0.55) });
    if (g.qr && l.qrToken) {
      const png = await QRCode.toBuffer(urlDeEntregaEscolar(baseUrl, l.qrToken), { type: "png", width: 240, margin: 1 });
      const qr = await doc.embedPng(png);
      page.drawImage(qr, { x: x + g.qr.x, y: yBase + g.qr.y, width: g.qr.lado, height: g.qr.lado });
    }
  }
  if (doc.getPageCount() === 0) doc.addPage([595, 842]);
  return doc.save();
}
