import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { getSignedUrlForFile } from "@/lib/r2-client";
import { resolveAlbumPublicVideoAccess } from "@/lib/videos/public-album-video-access";
import { resolvePreviewResponseCache } from "@/lib/videos/preview-response-cache";

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
          select: {
            id: true,
            userId: true,
            isPublic: true,
            isHidden: true,
            isTest: true,
            deletedAt: true,
            hiddenPhotosEnabled: true,
          },
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

    // En un álbum con contenido oculto, el adelanto sigue la misma regla que el
    // listado: sólo los videos que esa persona tiene permitidos. Sin esto,
    // alguien podía pedir el adelanto de un video ajeno adivinando el número,
    // porque los ids son correlativos.
    if (video.album.hiddenPhotosEnabled) {
      const acceso = await resolveAlbumPublicVideoAccess(req, {
        id: video.album.id,
        userId: video.album.userId,
        isTest: video.album.isTest,
        isPublic: video.album.isPublic,
        isHidden: video.album.isHidden,
        hiddenPhotosEnabled: video.album.hiddenPhotosEnabled,
      });

      const permitidos = acceso.ok ? acceso.access.allowedVideoIds : [];
      if (!acceso.ok || (Array.isArray(permitidos) && !permitidos.includes(videoId))) {
        console.info("[video-preview] adelanto bloqueado por álbum oculto", {
          videoId,
          albumId: video.album.id,
        });
        return NextResponse.json({ error: "Vista previa no disponible" }, { status: 404 });
      }
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
    for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    // El estado y la caché los decide una sola función, probada aparte: el
    // adelanto se guarda en el navegador de cada persona y nunca en el CDN
    // compartido, porque ahí un fragmento terminaba repartido como 200.
    const cache = resolvePreviewResponseCache({
      requestedRange: range,
      upstreamStatus: upstream.status,
      hasContentRange: headers.has("content-range"),
    });
    headers.set("Cache-Control", cache.cacheControl);
    headers.set("Vary", cache.vary);

    return new NextResponse(upstream.body, { status: cache.status, headers });
  } catch (err: unknown) {
    console.error("[video-preview] fatal", err);
    return NextResponse.json({ error: "Vista previa no disponible" }, { status: 500 });
  }
}
