/**
 * Export endpoint para pedidos de impresión.
 * Devuelve un ZIP con la carpeta organizada para impresión (Producto/Acabado/Tamaño/archivos).
 * Requiere que el usuario sea el fotógrafo o el laboratorio del pedido (o admin).
 *
 * IMPORTANTE: Los archivos ahora están en Cloudflare R2, no en el filesystem local.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { Role } from "@prisma/client";
import { readFromR2, fileExistsInR2, urlToR2Key } from "@/lib/r2-client";
import { getExportFolderName } from "@/lib/print-products";
import { safeFilename } from "@/lib/safe-filename";
import archiver from "archiver";
import { Readable } from "stream";
import { PDFDocument, StandardFonts } from "pdf-lib";
import path from "path"; // Solo para path.extname

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function parseId(raw: any): number | null {
  const val = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

function summarize(order: any, getProductName: (size: string, acabado: string) => string) {
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
  return summary;
}

async function buildPdf(
  order: any,
  getProductName: (size: string, acabado: string) => string,
  displayOrderId: number
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();

  let y = height - 50;
  const left = 50;

  const draw = (text: string, size = 11, gap = 16) => {
    page.drawText(text, { x: left, y, size, font });
    y -= gap;
  };

  // Título
  page.drawText("RESUMEN DE PEDIDO - IMPRESIONES", { x: left, y, size: 16, font });
  y -= 28;

  draw(`Pedido N°: ${displayOrderId}`, 12);
  draw(`Fecha: ${formatDate(order.createdAt)}`, 12);
  draw(`Moneda: ${order.currency}`, 12);
  draw(`Total: ${order.total}`, 12);
  y -= 10;

  draw("Datos del cliente", 13);
  draw(`Nombre: ${order.customerName || "-"}`);
  draw(`Email: ${order.customerEmail || "-"}`);
  draw(`Teléfono: ${order.customerPhone || "-"}`);
  y -= 10;

  draw("Resumen de producción (por producto, acabado y tamaño)", 13);
  const summary = summarize(order, getProductName);

  const products = Object.keys(summary).sort();
  for (const productName of products) {
    draw(`Producto: ${productName}`, 12);
    const finishes = Object.keys(summary[productName]).sort();
    for (const finish of finishes) {
      draw(`  Acabado: ${finish}`, 11);
      const sizes = Object.keys(summary[productName][finish]).sort();
      for (const size of sizes) {
        const row = summary[productName][finish][size];
        draw(`    • ${size} — Fotos: ${row.photos} — Copias: ${row.copies}`, 10);
      }
      y -= 4;
    }
    y -= 6;
    if (y < 80) break; // por ahora, simple (1 página)
  }

  y -= 10;
  draw(
    "Notas: Archivos organizados por Producto, luego Acabado y Tamaño. Cada archivo indica cantidad de copias.",
    10,
    14
  );

  return await pdfDoc.save();
}

export async function GET(
  _req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const params: any = await Promise.resolve((ctx as any).params);
    const orderId = parseId(params?.id);

    if (!orderId) {
      return NextResponse.json(
        { error: "ID inválido", debug: { raw: params?.id } },
        { status: 400 }
      );
    }

    const order = await prisma.printOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const user = await getAuthUser();
    const canAccess =
      user?.role === Role.ADMIN ||
      (order.photographerId != null && order.photographerId === user?.id) ||
      (user?.labId != null && order.labId === user.labId);
    if (!user || !canAccess) {
      return NextResponse.json(
        { error: "No tenés permiso para descargar este pedido. Iniciá sesión como fotógrafo o laboratorio del pedido." },
        { status: 403 }
      );
    }

    if (order.paymentStatus !== "PAID") {
      return NextResponse.json(
        { error: "La descarga está disponible solo cuando el pago está aprobado." },
        { status: 403 }
      );
    }

    const tags = Array.isArray(order.tags) ? order.tags : [];
    const tagMatch = tags
      .map((t) => String(t))
      .map((t) => t.match(/^ALBUM_ORDER:(\d+)$/))
      .find(Boolean);
    const linkedAlbumOrderId = tagMatch ? Number(tagMatch[1]) : null;
    const displayOrderId = Number.isFinite(linkedAlbumOrderId) ? (linkedAlbumOrderId as number) : order.id;

    const customer = safeName(order.customerName || "Cliente");
    const baseFolder = safeName(`Pedido-${pad(displayOrderId)} - ${customer}`);

    // Cargar productos: laboratorio o fotógrafo (cuando no hay lab, precios del fotógrafo)
    type ProductRow = { name: string; size: string | null; acabado: string | null };
    let productRows: ProductRow[] = [];
    if (order.labId != null) {
      productRows = await prisma.labProduct.findMany({
        where: { labId: order.labId, isActive: true },
        select: { name: true, size: true, acabado: true },
      });
    } else if (order.photographerId != null) {
      const pp = await prisma.photographerProduct.findMany({
        where: { userId: order.photographerId, isActive: true },
        select: { name: true, size: true, acabado: true },
      });
      productRows = pp;
    }

    const getProductName = (size: string, acabado: string): string => {
      const product = productRows.find(
        (p) => (p.size || "") === size && (p.acabado || "") === acabado
      );
      if (product) return product.name;
      const productBySize = productRows.find((p) => (p.size || "") === size);
      if (productBySize) return productBySize.name;
      return "Foto Impresa";
    };

    // Manifest técnico
    const lines: string[] = [];
    lines.push(`Pedido: ${displayOrderId}`);
    lines.push(`Cliente: ${order.customerName || "-"}`);
    lines.push(`Email: ${order.customerEmail || "-"}`);
    lines.push(`Teléfono: ${order.customerPhone || "-"}`);
    lines.push(`Fecha: ${order.createdAt.toISOString()}`);
    lines.push(`Moneda: ${order.currency}`);
    lines.push(`Total: ${order.total}`);
    lines.push("");
    lines.push("ITEMS:");
    lines.push("Producto | Acabado | Tamaño | Cantidad | Archivo original | fileKey | Ruta ZIP");

    // ZIP streaming
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (err) => console.warn("ARCHIVER WARNING:", err));
    archive.on("error", (err) => {
      throw err;
    });

    for (const it of order.items) {
      const finish = safeName(String(it.acabado || "BRILLO"));
      const size = safeName(String(it.size));
      const qty = Number(it.quantity || 0);
      const productNameRaw = getProductName(size, finish);
      const productName = safeName(getExportFolderName(productNameRaw));

      const originalName = safeName(it.originalName || it.fileKey);
      const ext = path.extname(originalName) || path.extname(it.fileKey) || ".jpg";

      // ✅ Nuevo formato: "10 Copias - {size} - {originalName}"
      const filename = `${qty} Copias - ${size} - ${originalName.replace(ext, "")}${ext}`;
      // ✅ Estructura: Producto (Fotos carnet / Polaroids / otro)/Acabado/Tamaño/Archivo
      const zipPath = `${baseFolder}/${productName}/${finish}/${size}/${filename}`;

      // Convertir fileKey a key de R2
      const r2Key = urlToR2Key(it.fileKey);

      try {
        // Verificar que existe en R2
        const exists = await fileExistsInR2(r2Key);
        if (exists) {
          // Leer desde R2 y agregar al ZIP
          const fileBuffer = await readFromR2(r2Key);
          archive.append(fileBuffer, { name: zipPath });
          lines.push(`${productName} | ${finish} | ${size} | ${qty} | ${it.originalName || "-"} | ${it.fileKey} | ${zipPath}`);
        } else {
          lines.push(`${productName} | ${finish} | ${size} | ${qty} | ${it.originalName || "-"} | ${it.fileKey} | (FALTA ARCHIVO)`);
        }
      } catch (error: any) {
        console.error(`Error leyendo archivo ${it.fileKey} de R2:`, error);
        lines.push(`${productName} | ${finish} | ${size} | ${qty} | ${it.originalName || "-"} | ${it.fileKey} | (FALTA ARCHIVO)`);
      }
    }

    // MANIFEST.txt
    archive.append(lines.join("\n"), { name: `${baseFolder}/MANIFEST.txt` });

    // PDF (sin pdfkit)
    const pdfBytes = await buildPdf(order, getProductName, displayOrderId);
    archive.append(Buffer.from(pdfBytes), { name: `${baseFolder}/RESUMEN_PEDIDO.pdf` });

    // Response ZIP
    const webStream = Readable.toWeb(archive);
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${safeName(baseFolder)}.zip"`);

    archive.finalize();
    return new Response(webStream as any, { headers });
  } catch (err: any) {
    console.error("EXPORT ERROR >>>", err);
    return NextResponse.json(
      { error: "Error exportando pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
