import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { getSignedUrlForFile } from "@/lib/r2-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/public/videos/[id]/preview
 *
 * Sirve el adelanto con marca de agua desde el dominio del sitio, igual que las
 * fotos (`/api/photos/[id]/view`).
 *
 * Por qué no mandar al cliente directo a R2: el dominio `pub-….r2.dev` es el de
 * desarrollo de Cloudflare. Sirve archivos, pero los navegadores y las
 * extensiones lo tratan distinto que al dominio del sitio, y ahí el reproductor
 * fallaba con "URL no accesible" aunque el archivo estuviera sano. De paso, la
 * ubicación real del archivo deja de viajar al navegador.
 *
 * Respeta las peticiones por rango, que es como los reproductores piden video.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const { id } = await Promise.resolve(params);
    const videoId = parseInt(id, 10);
    if (!Number.isFinite(videoId)) {
      return NextResponse.json({ error: "Video inválido" }, { status: 400 });
    }

    const video = await prisma.videoAsset.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        previewKey: true,
        isRemoved: true,
        expiresAt: true,
        processingStatus: true,
        album: {
          select: { id: true, isPublic: true, isHidden: true, isTest: true, deletedAt: true },
        },
      },
    });

    if (
      !video ||
      !video.previewKey ||
      video.isRemoved ||
      video.processingStatus !== "READY" ||
      video.expiresAt.getTime() <= Date.now() ||
      !video.album ||
      video.album.deletedAt ||
      !isAlbumPubliclyAccessible(video.album)
    ) {
      return NextResponse.json({ error: "Vista previa no disponible" }, { status: 404 });
    }

    const signedUrl = await getSignedUrlForFile(video.previewKey, 900);

    // El rango que pidió el reproductor se reenvía tal cual: sin esto el
    // navegador no puede saltar a un punto del video ni mostrar la duración.
    const range = req.headers.get("range");
    const upstream = await fetch(signedUrl, {
      headers: range ? { Range: range } : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      console.error("[video-preview] R2 respondió", {
        videoId,
        status: upstream.status,
      });
      return NextResponse.json({ error: "Vista previa no disponible" }, { status: 502 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "video/mp4");
    headers.set("Accept-Ranges", "bytes");
    // El adelanto tiene la marca quemada y no cambia: se puede cachear fuerte.
    headers.set("Cache-Control", "public, max-age=3600");
    for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    // Si vino un rango, la respuesta TIENE que ser 206. Un 200 con
    // Content-Range es incorrecto y Safari lo rechaza al reproducir.
    const status = headers.has("content-range") ? 206 : upstream.status;

    return new NextResponse(upstream.body, { status, headers });
  } catch (err: unknown) {
    console.error("[video-preview] fatal", err);
    return NextResponse.json({ error: "Vista previa no disponible" }, { status: 500 });
  }
}
