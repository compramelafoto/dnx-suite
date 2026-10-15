/**
 * La foto de un testimonio publicado.
 *
 * Las fotos de perfil viven en el namespace privado de R2, que `/api/media` no
 * sirve. Esta ruta las entrega de a una y sólo cuando el testimonio está
 * publicado y consentido: la llave es la publicación, no la clave del archivo.
 */
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { canServeTestimonialPhoto } from "@/lib/testimonials/public/photo-access";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ testimonialId: string }> };

function notFound() {
  // Siempre 404, nunca 403: un 403 confirmaría que el testimonio existe.
  return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  const { testimonialId } = await params;
  if (!testimonialId) return notFound();

  const testimonial = await prisma.clickatonTestimonial.findUnique({
    where: { id: testimonialId },
    select: {
      status: true,
      publicationConsent: true,
      authorPhotoAssetId: true,
    },
  });

  if (!canServeTestimonialPhoto(testimonial)) return notFound();

  const asset = await prisma.dnxMediaAsset.findUnique({
    where: { id: testimonial!.authorPhotoAssetId! },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset) return notFound();

  try {
    const body = await getWelcomeCardStorage().get(asset.storageKey);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "image/jpeg",
        // Cacheo corto a propósito: despublicar tiene que notarse pronto.
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
