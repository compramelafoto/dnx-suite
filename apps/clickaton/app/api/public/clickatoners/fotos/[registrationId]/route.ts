/**
 * La foto de perfil de un clickatoner, para la portada y su página pública.
 *
 * Las fotos de perfil viven en el namespace privado de R2, que `/api/media` no sirve. Igual que
 * la foto de un testimonio, la llave no es el archivo sino la publicación: sólo sale la foto de
 * alguien que hoy puede aparecer (edición con resultados publicados, aceptó las bases y no pidió
 * quedar afuera). Pedir salir corta el acceso en el acto.
 */
import { prisma } from "@repo/db";
import { NextResponse } from "next/server";
import { servablePhotoAsset } from "@/lib/clickatoner/repository";
import { getWelcomeCardStorage } from "@/lib/welcome-card/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ registrationId: string }> };

function notFound() {
  // Siempre 404, nunca 403: un 403 confirmaría que la persona existe.
  return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  const { registrationId } = await params;
  if (!registrationId) return notFound();

  const assetId = await servablePhotoAsset(registrationId);
  if (!assetId) return notFound();

  const asset = await prisma.dnxMediaAsset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, mimeType: true },
  });
  if (!asset) return notFound();

  try {
    const body = await getWelcomeCardStorage().get(asset.storageKey);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "image/jpeg",
        // Cacheo corto a propósito: pedir salir tiene que notarse pronto.
        "Cache-Control": "public, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
