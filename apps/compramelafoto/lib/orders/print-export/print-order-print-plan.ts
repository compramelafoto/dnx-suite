/**
 * Carpeta de impresión de un pedido de impresión (PrintOrder): Producto/Acabado/Tamaño.
 * Antes vivía dentro de `api/print-orders/[id]/export`; se sacó acá para compartirla con
 * la descarga de varios pedidos juntos.
 */

import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma, Role } from "@/lib/prisma";
import { urlToR2Key } from "@/lib/r2-client";
import { getExportFolderName } from "@/lib/print-products";
import { safeFilename } from "@/lib/safe-filename";
import { formatBuyerContactForPhotographer } from "@/lib/orders/resolve-album-order-buyer-contact";
import type { PlanResult, PrintExportUser } from "./album-order-print-plan";
import { resolveExportProductName } from "./export-product-name";

/** Referencia lógica del carrito de álbum en PrintOrderItem.fileKey (no es key de R2). */
const PRINT_ORDER_FILE_KEY_PHOTO_REF = /^photo:(\d+)$/i;

type PrintOrderItemRow = { acabado: string | null; size: string; quantity: number };

function safeName(name: string): string {
  return safeFilename(name, "Cliente");
}

function pad(n: number, len = 6) {
  return String(n).padStart(len, "0");
}

function formatDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

async function buildPdf(
  order: { createdAt: Date; currency: string; total: unknown; items: PrintOrderItemRow[] },
  buyer: { name: string | null; email: string | null; phone: string | null },
  getProductName: (size: string, acabado: string) => string,
  displayOrderId: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.addPage([595.28, 841.89]);
  let y = page.getSize().height - 50;
  const left = 50;

  const draw = (text: string, size = 11, gap = 16) => {
    page.drawText(text, { x: left, y, size, font });
    y -= gap;
  };

  page.drawText("RESUMEN DE PEDIDO - IMPRESIONES", { x: left, y, size: 16, font });
  y -= 28;

  draw(`Pedido N°: ${displayOrderId}`, 12);
  draw(`Fecha: ${formatDate(order.createdAt)}`, 12);
  draw(`Moneda: ${order.currency}`, 12);
  draw(`Total: ${order.total}`, 12);
  y -= 10;

  draw("Datos del cliente", 13);
  draw(`Nombre: ${buyer.name || "-"}`);
  draw(`Email: ${buyer.email || "-"}`);
  draw(`WhatsApp / teléfono: ${buyer.phone || "-"}`);
  y -= 10;

  draw("Resumen de producción (por producto, acabado y tamaño)", 13);
  const summary: Record<string, Record<string, Record<string, { photos: number; copies: number }>>> = {};
  for (const it of order.items) {
    const finish = String(it.acabado || "BRILLO");
    const size = String(it.size);
    const productName = getProductName(size, finish);
    summary[productName] ??= {};
    summary[productName][finish] ??= {};
    summary[productName][finish][size] ??= { photos: 0, copies: 0 };
    summary[productName][finish][size].photos += 1;
    summary[productName][finish][size].copies += Number(it.quantity || 0);
  }
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

  y -= 10;
  draw(
    "Notas: Archivos organizados por Producto, luego Acabado y Tamaño. Cada archivo indica cantidad de copias.",
    10,
    14
  );
  return await pdfDoc.save();
}

export async function loadPrintOrderPrintPlan(orderId: number, user: PrintExportUser): Promise<PlanResult> {
  const order = await prisma.printOrder.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, status: 404, error: "Pedido no encontrado" };

  const canAccess =
    user.role === Role.ADMIN ||
    (order.photographerId != null && order.photographerId === user.id) ||
    (user.labId != null && order.labId === user.labId);
  if (!canAccess) {
    return {
      ok: false,
      status: 403,
      error: "No tenés permiso para descargar este pedido. Iniciá sesión como fotógrafo o laboratorio del pedido.",
    };
  }
  if (order.paymentStatus !== "PAID") {
    return { ok: false, status: 403, error: "La descarga está disponible solo cuando el pago está aprobado." };
  }

  const tags = Array.isArray(order.tags) ? order.tags : [];
  const tagMatch = tags
    .map((t) => String(t))
    .map((t) => t.match(/^ALBUM_ORDER:(\d+)$/))
    .find(Boolean);
  const linkedAlbumOrderId = tagMatch ? Number(tagMatch[1]) : null;
  const displayOrderId = Number.isFinite(linkedAlbumOrderId) ? (linkedAlbumOrderId as number) : order.id;

  let buyer = {
    name: order.customerName?.trim() || null,
    email: order.customerEmail?.trim() || null,
    phone: order.customerPhone?.trim() || null,
  };
  if (linkedAlbumOrderId != null && Number.isFinite(linkedAlbumOrderId)) {
    const albumOrder = await prisma.order.findUnique({
      where: { id: linkedAlbumOrderId },
      select: {
        buyerEmail: true,
        buyerName: true,
        buyerPhone: true,
        buyerUser: { select: { name: true, phone: true, whatsapp: true } },
      },
    });
    if (albumOrder) {
      const resolved = formatBuyerContactForPhotographer(albumOrder, albumOrder.buyerUser);
      buyer = {
        name: buyer.name || resolved.name,
        email: buyer.email || resolved.email,
        phone: buyer.phone || resolved.phone,
      };
    }
  }

  const customer = safeName(buyer.name || buyer.email || "Cliente");
  const folder = safeName(`Pedido-${pad(displayOrderId)} - ${customer}`);

  type ProductRow = { name: string; size: string | null; acabado: string | null };
  let productRows: ProductRow[] = [];
  if (order.labId != null) {
    productRows = await prisma.labProduct.findMany({
      where: { labId: order.labId, isActive: true },
      select: { name: true, size: true, acabado: true },
    });
  } else if (order.photographerId != null) {
    productRows = await prisma.photographerProduct.findMany({
      where: { userId: order.photographerId, isActive: true },
      select: { name: true, size: true, acabado: true },
    });
  }
  const getProductName = (size: string, acabado: string): string =>
    resolveExportProductName(productRows, size, acabado);

  const photoIds = new Set<number>();
  for (const it of order.items) {
    const m = String(it.fileKey).match(PRINT_ORDER_FILE_KEY_PHOTO_REF);
    if (m && Number.isFinite(Number(m[1]))) photoIds.add(Number(m[1]));
  }
  const photos = photoIds.size
    ? await prisma.photo.findMany({ where: { id: { in: [...photoIds] } }, select: { id: true, originalKey: true } })
    : [];
  const originalKeyByPhotoId = new Map(photos.map((p) => [p.id, p.originalKey] as const));

  const files = order.items.map((it) => {
    const finish = safeName(String(it.acabado || "BRILLO"));
    const size = safeName(String(it.size));
    const qty = Number(it.quantity || 0);
    const productName = safeName(getExportFolderName(getProductName(size, finish)));
    const originalName = safeName(it.originalName || it.fileKey);
    const ext = path.extname(originalName) || path.extname(it.fileKey) || ".jpg";
    const zipPath = `${folder}/${productName}/${finish}/${size}/${qty} Copias - ${size} - ${originalName.replace(ext, "")}${ext}`;

    let sourceKey = it.fileKey;
    const ref = String(it.fileKey).match(PRINT_ORDER_FILE_KEY_PHOTO_REF);
    if (ref) {
      const resolved = originalKeyByPhotoId.get(Number(ref[1]));
      if (resolved) sourceKey = resolved;
    }
    const base = `${productName} | ${finish} | ${size} | ${qty} | ${it.originalName || "-"} | ${it.fileKey}`;
    return {
      zipPath,
      r2Key: urlToR2Key(sourceKey),
      manifestLine: `${base} | ${zipPath}`,
      missingLine: `${base} | (FALTA ARCHIVO)`,
    };
  });

  return {
    ok: true,
    plan: {
      folder,
      manifestHeader: [
        `Pedido: ${displayOrderId}`,
        `Nombre: ${buyer.name || "-"}`,
        `Email: ${buyer.email || "-"}`,
        `WhatsApp / teléfono: ${buyer.phone || "-"}`,
        `Fecha: ${order.createdAt.toISOString()}`,
        `Moneda: ${order.currency}`,
        `Total: ${order.total}`,
        "",
        "ITEMS:",
        "Producto | Acabado | Tamaño | Cantidad | Archivo original | fileKey | Ruta ZIP",
      ],
      files,
      pdfBytes: await buildPdf(order, buyer, getProductName, displayOrderId),
    },
  };
}
