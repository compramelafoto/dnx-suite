/**
 * Carpeta de impresión de un pedido de álbum (Order): sólo ítems PRINT/FRAME, organizados
 * por Producto/Acabado/Tamaño. Antes vivía dentro de `api/fotografo/pedidos/[orderId]/export-print`;
 * se sacó acá para que la descarga de un pedido y la de varios armen exactamente lo mismo.
 */

import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma, Role } from "@/lib/prisma";
import { formatBuyerContactForPhotographer } from "@/lib/orders/resolve-album-order-buyer-contact";
import type { PrintExportPlan } from "./stream-print-export-zip";
import {
  acabadoParaExportar,
  chosenProductNameFromMetadata,
  productosDelAlbum,
  resolveExportProductName,
} from "./export-product-name";
import { alumnoDesdeRefs, rotuloDeAlumno, type AlumnoDelPedido } from "./alumno-del-pedido";
import { copiasFueraDelDiseno } from "./copias-fuera-del-diseno";
import { archivosDelPedido } from "./archivos-del-pedido";
import { loadOrderDesigns } from "./order-designs";
import { carpetaDePedido } from "./rutas-cortas";

export type PlanResult = { ok: true; plan: PrintExportPlan } | { ok: false; status: number; error: string };

export type PrintExportUser = { id: number; role: string; labId?: number | null };


function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

async function buildPdf(
  order: {
    id: number;
    createdAt: Date;
    totalCents: number;
    items: { finish?: string | null; size?: string | null; quantity: number; metadata?: unknown }[];
  },
  buyer: { name: string | null; email: string | null; phone: string | null },
  getProductName: (size: string, acabado: string, metadata?: unknown) => string,
  extraLines: string[] = [],
  alumno: AlumnoDelPedido | null = null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595.28, 841.89]);
  let y = page.getHeight() - 50;
  const left = 50;

  const draw = (text: string, size = 11, gap = 16) => {
    page.drawText(text, { x: left, y, size, font });
    y -= gap;
  };

  page.drawText("RESUMEN PEDIDO ÁLBUM - IMPRESIONES", { x: left, y, size: 16, font });
  y -= 28;

  draw(`Pedido N°: ${order.id}`, 12);
  draw(`Fecha: ${formatDate(order.createdAt)}`, 12);
  draw(`Total: $${order.totalCents} ARS`, 12);
  y -= 10;

  if (alumno) {
    draw("Alumno", 13);
    draw(`Nombre: ${alumno.alumno}`, 12);
    draw(`Curso: ${alumno.curso || "-"}`, 12);
    y -= 10;
  }
  draw(alumno ? "Adulto que hizo el pedido" : "Datos del cliente", 13);
  draw(`Nombre: ${buyer.name || "-"}`, 12);
  draw(`Email: ${buyer.email || "-"}`, 12);
  draw(`WhatsApp / teléfono: ${buyer.phone || "-"}`, 12);
  y -= 10;

  const summary: Record<string, Record<string, Record<string, { photos: number; copies: number }>>> = {};
  for (const it of order.items) {
    const finish = String(it.finish || "Sin acabado");
    const size = String(it.size || "");
    const productName = getProductName(size, String(it.finish || ""), it.metadata);
    summary[productName] ??= {};
    summary[productName][finish] ??= {};
    summary[productName][finish][size] ??= { photos: 0, copies: 0 };
    summary[productName][finish][size].photos += 1;
    summary[productName][finish][size].copies += Number(it.quantity || 0);
  }

  draw("Resumen por producto / acabado / tamaño", 13);
  for (const productName of Object.keys(summary).sort()) {
    draw(`Producto: ${productName}`, 12);
    for (const finish of Object.keys(summary[productName]).sort()) {
      draw(`  Acabado: ${finish}`, 11);
      for (const size of Object.keys(summary[productName][finish]).sort()) {
        const row = summary[productName][finish][size];
        draw(`    • ${size} — Fotos: ${row.photos} — Copias: ${row.copies}`, 10);
      }
      y -= 4;
    }
    y -= 6;
    if (y < 80) break;
  }

  if (extraLines.length > 0 && y > 80) {
    y -= 6;
    for (const line of extraLines) {
      if (y < 60) break;
      draw(line, line.startsWith("  ") ? 10 : 13);
    }
  }

  return await pdfDoc.save();
}

async function cargarPlan(orderId: number, user: PrintExportUser | null, incluirDisenos: boolean): Promise<PlanResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      album: { select: { userId: true } },
      buyerUser: { select: { name: true, phone: true, whatsapp: true } },
      items: {
        where: { productType: { in: ["PRINT", "FRAME"] } },
        include: { photo: { select: { originalKey: true } } },
      },
    },
  });

  const isAdmin = user?.role === Role.ADMIN;
  if (!order || (user && !isAdmin && order.album?.userId !== user.id)) {
    return { ok: false, status: 404, error: "Pedido no encontrado o sin permiso" };
  }
  if (order.status !== "PAID") {
    return { ok: false, status: 403, error: "La descarga está disponible solo cuando el pago está aprobado." };
  }
  // Productos con plantilla (carpeta escolar, librito): se imprimen como el PDF del diseño,
  // no como las fotos sueltas que lo forman.
  const designs = await loadOrderDesigns(order.id);
  const sueltas = copiasFueraDelDiseno(
    order.items,
    designs.flatMap((d) => d.photoIds),
  );
  if (sueltas.length === 0 && (!incluirDisenos || designs.length === 0)) {
    return { ok: false, status: 400, error: "Este pedido no tiene ítems de impresión" };
  }

  const productRows = productosDelAlbum(
    await prisma.photographerProduct.findMany({
      where: { userId: order.album!.userId, isActive: true },
      select: { name: true, size: true, acabado: true, albumId: true },
    }),
    order.albumId,
  );
  const getProductName = (size: string, acabado: string, metadata?: unknown) =>
    resolveExportProductName(productRows, size, acabado, chosenProductNameFromMetadata(metadata));
  // Sin acabado cargado en el producto no se muestra el "BRILLO" que grabó el canje por defecto.
  const sueltasLimpias = sueltas.map((it) => ({
    ...it,
    finish: acabadoParaExportar(
      productRows,
      String(it.size || ""),
      String(it.finish || ""),
      chosenProductNameFromMetadata(it.metadata),
    ),
  }));

  // Pedido canjeado desde un pack escolar cobrado por fuera: la carpeta va con alumno y curso.
  const packs = await prisma.order.findMany({
    where: { redemptionOrderId: order.id },
    select: { redemptionPaymentRefsJson: true },
  });
  const alumno = packs.map((p) => alumnoDesdeRefs(p.redemptionPaymentRefsJson)).find(Boolean) ?? null;

  const buyer = formatBuyerContactForPhotographer(order, order.buyerUser);
  if (!buyer.phone) {
    const mirror = await prisma.printOrder.findFirst({
      where: { tags: { has: `ALBUM_ORDER:${order.id}` } },
      select: { customerPhone: true, customerName: true },
    });
    const mirrorPhone = mirror?.customerPhone?.trim() || null;
    if (!buyer.name && mirror?.customerName?.trim()) buyer.name = mirror.customerName.trim();
    if (!buyer.phone && mirrorPhone) buyer.phone = mirrorPhone;
  }

  // Rutas cortas: Windows no descomprime rutas largas (ver `rutas-cortas`).
  const codigo = String(order.id);
  const folder = alumno
    ? carpetaDePedido(codigo, rotuloDeAlumno(alumno), 32)
    : carpetaDePedido(codigo, buyer.name || buyer.email || "Cliente");

  const { files, notes, designLines } = archivosDelPedido({
    items: order.items,
    sueltas: sueltasLimpias,
    designs,
    folder,
    getProductName,
    incluirDisenos,
  });

  return {
    ok: true,
    plan: {
      folder,
      codigo,
      notes,
      manifestHeader: [
        `Pedido Álbum: ${order.id}`,
        ...(alumno ? [`Alumno: ${alumno.alumno}`, `Curso: ${alumno.curso || "-"}`] : []),
        `${alumno ? "Adulto" : "Nombre"}: ${buyer.name || "-"}`,
        `Email: ${buyer.email || "-"}`,
        `WhatsApp / teléfono: ${buyer.phone || "-"}`,
        `Fecha: ${order.createdAt.toISOString()}`,
        `Total: ${order.totalCents} ARS`,
        "",
        "ITEMS IMPRESIÓN:",
        "Producto | Acabado | Tamaño | Cantidad | Ruta ZIP",
      ],
      files,
      pdfBytes: await buildPdf(
        { ...order, items: sueltasLimpias },
        buyer,
        getProductName,
        designLines.length ? ["Diseños (carpetas, libritos)", ...designLines] : [],
        alumno
      ),
    },
  };
}

/** Descarga del fotógrafo o del admin: el plan completo (con los diseños), si el pedido es suyo. */
export async function loadAlbumOrderPrintPlan(orderId: number, user: PrintExportUser): Promise<PlanResult> {
  return cargarPlan(orderId, user, true);
}

/**
 * El mismo plan sin chequear quién lo pide: el que llama ya verificó el permiso (p. ej. el lote
 * de impresión es del fotógrafo). Con `incluirDisenos: false` van sólo las copias sueltas: ni el
 * PDF ni las caras de un librito o carpeta, ni el aviso de un diseño pendiente.
 */
export async function cargarPlanDePedidoDeAlbum(
  orderId: number,
  { incluirDisenos = true }: { incluirDisenos?: boolean } = {},
): Promise<PlanResult> {
  return cargarPlan(orderId, null, incluirDisenos);
}
