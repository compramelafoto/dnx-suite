/**
 * Carpeta de impresión de un pedido de álbum (Order): sólo ítems PRINT/FRAME, organizados
 * por Producto/Acabado/Tamaño. Antes vivía dentro de `api/fotografo/pedidos/[orderId]/export-print`;
 * se sacó acá para que la descarga de un pedido y la de varios armen exactamente lo mismo.
 */

import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { prisma, Role } from "@/lib/prisma";
import { urlToR2Key } from "@/lib/r2-client";
import { safeFilename } from "@/lib/safe-filename";
import { formatBuyerContactForPhotographer } from "@/lib/orders/resolve-album-order-buyer-contact";
import type { PrintExportPlan } from "./stream-print-export-zip";

export type PlanResult = { ok: true; plan: PrintExportPlan } | { ok: false; status: number; error: string };

export type PrintExportUser = { id: number; role: string; labId?: number | null };

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

function productNameFromRows(
  productRows: { name: string; size: string | null; acabado: string | null }[],
  size: string,
  acabado: string
): string {
  const product = productRows.find((p) => (p.size || "") === size && (p.acabado || "") === acabado);
  if (product) return product.name;
  const bySize = productRows.find((p) => (p.size || "") === size);
  if (bySize) return bySize.name;
  return "Foto Impresa";
}

async function buildPdf(
  order: {
    id: number;
    createdAt: Date;
    totalCents: number;
    items: { finish?: string | null; size?: string | null; quantity: number }[];
  },
  buyer: { name: string | null; email: string | null; phone: string | null },
  getProductName: (size: string, acabado: string) => string
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

  draw("Datos del cliente", 13);
  draw(`Nombre: ${buyer.name || "-"}`, 12);
  draw(`Email: ${buyer.email || "-"}`, 12);
  draw(`WhatsApp / teléfono: ${buyer.phone || "-"}`, 12);
  y -= 10;

  const summary: Record<string, Record<string, Record<string, { photos: number; copies: number }>>> = {};
  for (const it of order.items) {
    const finish = String(it.finish || "BRILLO");
    const size = String(it.size || "");
    const productName = getProductName(size, finish);
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

  return await pdfDoc.save();
}

export async function loadAlbumOrderPrintPlan(orderId: number, user: PrintExportUser): Promise<PlanResult> {
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

  const isAdmin = user.role === Role.ADMIN;
  if (!order || (!isAdmin && order.album?.userId !== user.id)) {
    return { ok: false, status: 404, error: "Pedido no encontrado o sin permiso" };
  }
  if (order.status !== "PAID") {
    return { ok: false, status: 403, error: "La descarga está disponible solo cuando el pago está aprobado." };
  }
  if (order.items.length === 0) {
    return { ok: false, status: 400, error: "Este pedido no tiene ítems de impresión" };
  }

  const productRows = await prisma.photographerProduct.findMany({
    where: { userId: order.album!.userId, isActive: true },
    select: { name: true, size: true, acabado: true },
  });
  const getProductName = (size: string, acabado: string) => productNameFromRows(productRows, size, acabado);

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

  const customerLabel = safeName(buyer.name || buyer.email || "Cliente");
  const folder = `Pedido-Album-${pad(order.id)} - ${customerLabel}`;

  const files = order.items.map((it) => {
    const finish = safeName(String(it.finish || "BRILLO"));
    const size = safeName(String(it.size || ""));
    const qty = Number(it.quantity || 0);
    const productName = safeName(getProductName(size, finish));
    const originalKey = it.photo?.originalKey ?? "";
    const baseName = path.basename(originalKey) || `foto-${it.photoId}`;
    const ext = path.extname(baseName) || ".jpg";
    const originalName = safeName(baseName.replace(ext, "")) + ext;
    const zipPath = `${folder}/${productName}/${finish}/${size}/${qty} Copias - ${size} - ${originalName}`;
    return {
      zipPath,
      r2Key: urlToR2Key(originalKey),
      manifestLine: `${productName} | ${finish} | ${size} | ${qty} | ${zipPath}`,
      missingLine: `${productName} | ${finish} | ${size} | ${qty} | (FALTA ARCHIVO)`,
    };
  });

  return {
    ok: true,
    plan: {
      folder,
      manifestHeader: [
        `Pedido Álbum: ${order.id}`,
        `Nombre: ${buyer.name || "-"}`,
        `Email: ${buyer.email || "-"}`,
        `WhatsApp / teléfono: ${buyer.phone || "-"}`,
        `Fecha: ${order.createdAt.toISOString()}`,
        `Total: ${order.totalCents} ARS`,
        "",
        "ITEMS IMPRESIÓN:",
        "Producto | Acabado | Tamaño | Cantidad | Ruta ZIP",
      ],
      files,
      pdfBytes: await buildPdf(order, buyer, getProductName),
    },
  };
}
