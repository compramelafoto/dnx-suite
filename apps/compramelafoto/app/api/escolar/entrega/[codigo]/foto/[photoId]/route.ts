import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicPhotoVariantConfig } from "@/lib/images/photo-variant-config";
import { tryServePregeneratedVariant } from "@/lib/images/resolve-photo-variant";
import { loadVariantGenerationSourceBuffer } from "@/lib/images/photo-variant-source";
import { renderPublicWatermarkedJpeg } from "@/lib/images/watermark-render";
import { loadCenterWatermarkTextForPhoto } from "@/lib/images/watermark-photographer-center";
import { cargarEntregaPorQr } from "@/lib/school-fulfillment/entrega-por-qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ codigo: string; photoId: string }> };

/**
 * GET ?tam=chica|grande — una foto del pedido del QR, SIEMPRE con marca de agua (la etiqueta va
 * pegada afuera del sobre: cualquiera la puede escanear). Sólo fotos que van en ese pedido.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const { codigo, photoId: crudo } = await context.params;
  const photoId = Number(crudo);
  const entrega = await cargarEntregaPorQr(decodeURIComponent(codigo));
  if (!entrega || !Number.isInteger(photoId) || !entrega.fotos.some((f) => f.photoId === photoId)) {
    return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });
  }
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    select: { id: true, albumId: true, previewUrl: true, originalKey: true, thumbWatermarkedKey: true, previewWatermarkedKey: true },
  });
  if (!photo || photo.albumId !== entrega.albumId) return NextResponse.json({ error: "Foto no encontrada" }, { status: 404 });

  const mode = req.nextUrl.searchParams.get("tam") === "grande" ? "preview" : "thumb";
  const guardada = await tryServePregeneratedVariant({ photo, mode });
  if (guardada) {
    guardada.headers.set("Cache-Control", "private, max-age=86400");
    return guardada;
  }
  try {
    const { buffer } = await loadVariantGenerationSourceBuffer({
      photoId: photo.id,
      albumId: photo.albumId,
      previewUrl: photo.previewUrl,
      originalKey: photo.originalKey,
    });
    const centerText = await loadCenterWatermarkTextForPhoto(prisma, { photoId: photo.id, albumId: photo.albumId });
    const jpg = await renderPublicWatermarkedJpeg(buffer, mode, getPublicPhotoVariantConfig(), centerText ? { centerText } : undefined);
    return new Response(new Uint8Array(jpg), {
      headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ error: "Foto no disponible" }, { status: 404 });
  }
}
