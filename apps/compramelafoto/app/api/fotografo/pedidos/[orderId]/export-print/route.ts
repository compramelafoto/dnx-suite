/**
 * Export ZIP de la carpeta de impresión para un pedido de álbum (Order).
 * Solo ítems con productType PRINT, organizados por Producto/Acabado/Tamaño.
 * Requiere que el usuario sea el fotógrafo del álbum.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { Role } from "@prisma/client";
import { readFromR2, fileExistsInR2, urlToR2Key } from "@/lib/r2-client";
import { safeFilename } from "@/lib/safe-filename";
import archiver from "archiver";
import { Readable } from "stream";
import { PDFDocument, StandardFonts } from "pdf-lib";
import path from "path";

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
  order: { id: number; createdAt: Date; totalCents: number; buyerEmail: string; items: { finish?: string | null; size?: string | null; quantity: number }[] },
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
  draw(`Cliente: ${order.buyerEmail}`, 12);
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

export async function GET(
  _req: Request,
  ctx: { params: { orderId: string } | Promise<{ orderId: string }> }
) {
  try {
    const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
    if (error || !user) {
      return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
    }

    const { orderId } = await Promise.resolve(ctx.params);
    const id = Number(orderId);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID de pedido inválido" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        album: { select: { userId: true } },
        items: {
          where: { productType: "PRINT" },
          include: { photo: { select: { originalKey: true } } },
        },
      },
    });

    if (!order || order.album?.userId !== user.id) {
      return NextResponse.json({ error: "Pedido no encontrado o sin permiso" }, { status: 404 });
    }

    if (order.status !== "PAID") {
      return NextResponse.json(
        { error: "La descarga está disponible solo cuando el pago está aprobado." },
        { status: 403 }
      );
    }

    if (order.items.length === 0) {
      return NextResponse.json(
        { error: "Este pedido no tiene ítems de impresión" },
        { status: 400 }
      );
    }

    const photographerId = order.album!.userId;
    const productRows = await prisma.photographerProduct.findMany({
      where: { userId: photographerId, isActive: true },
      select: { name: true, size: true, acabado: true },
    });
    const getProductName = (size: string, acabado: string) =>
      productNameFromRows(productRows, size, acabado);

    const baseFolder = `Pedido-Album-${pad(order.id)} - ${safeName(order.buyerEmail)}`;
    const lines: string[] = [
      `Pedido Álbum: ${order.id}`,
      `Cliente: ${order.buyerEmail}`,
      `Fecha: ${order.createdAt.toISOString()}`,
      `Total: ${order.totalCents} ARS`,
      "",
      "ITEMS IMPRESIÓN:",
      "Producto | Acabado | Tamaño | Cantidad | Ruta ZIP",
    ];

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("warning", (err) => console.warn("ARCHIVER WARNING:", err));
    archive.on("error", (err) => {
      throw err;
    });

    for (const it of order.items) {
      const finish = safeName(String(it.finish || "BRILLO"));
      const size = safeName(String(it.size || ""));
      const qty = Number(it.quantity || 0);
      const productName = safeName(getProductName(size, finish));

      const originalKey = it.photo?.originalKey ?? "";
      const baseName = path.basename(originalKey) || `foto-${it.photoId}`;
      const ext = path.extname(baseName) || ".jpg";
      const originalName = safeName(baseName.replace(ext, "")) + ext;
      const filename = `${qty} Copias - ${size} - ${originalName}`;
      const zipPath = `${baseFolder}/${productName}/${finish}/${size}/${filename}`;

      const r2Key = urlToR2Key(originalKey);

      try {
        const exists = await fileExistsInR2(r2Key);
        if (exists) {
          const fileBuffer = await readFromR2(r2Key);
          archive.append(fileBuffer, { name: zipPath });
          lines.push(`${productName} | ${finish} | ${size} | ${qty} | ${zipPath}`);
        } else {
          lines.push(`${productName} | ${finish} | ${size} | ${qty} | (FALTA ARCHIVO)`);
        }
      } catch (err: any) {
        console.error(`Error leyendo ${originalKey} de R2:`, err);
        lines.push(`${productName} | ${finish} | ${size} | ${qty} | (FALTA ARCHIVO)`);
      }
    }

    archive.append(lines.join("\n"), { name: `${baseFolder}/MANIFEST.txt` });

    const pdfBytes = await buildPdf(order, (s, a) => getProductName(s, a));
    archive.append(Buffer.from(pdfBytes), { name: `${baseFolder}/RESUMEN_PEDIDO.pdf` });

    const webStream = Readable.toWeb(archive);
    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="${safeName(baseFolder)}.zip"`);

    archive.finalize();
    return new Response(webStream as any, { headers });
  } catch (err: any) {
    console.error("EXPORT PRINT (album) ERROR >>>", err);
    return NextResponse.json(
      { error: "Error exportando carpeta de impresión", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
