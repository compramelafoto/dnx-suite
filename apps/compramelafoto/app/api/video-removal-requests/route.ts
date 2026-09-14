import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeRemovalRequestBody } from "@/lib/public/removal-request";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/video-removal-requests
 *
 * Pedido de baja de un video por derecho de imagen.
 *
 * A diferencia de una foto, dar de baja un video lo saca **entero** de
 * circulación: no se puede recortar a una persona de una escena en movimiento.
 * El texto que ve quien lo pide dice eso con todas las letras.
 *
 * Reusa la validación del pedido de baja de fotos —nombre, email, teléfono,
 * motivo y declaración— para no tener dos criterios distintos sobre lo mismo.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ error: "No disponible" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const videoId = Number(body.videoId);
    if (!Number.isFinite(videoId) || videoId <= 0) {
      return NextResponse.json({ error: "videoId es requerido" }, { status: 400 });
    }

    // La validación de los datos de la persona es la misma que en fotos; se le
    // pasa un photoId de relleno porque esa función lo exige y acá no aplica.
    const parsed = sanitizeRemovalRequestBody({ ...body, photoId: videoId });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    }
    const data = parsed.data;

    const video = await prisma.videoAsset.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        albumId: true,
        isRemoved: true,
        album: { select: { id: true, userId: true } },
      },
    });

    if (!video || video.albumId !== data.albumId || !video.album?.userId) {
      return NextResponse.json({ error: "Video no encontrado" }, { status: 404 });
    }

    if (video.isRemoved) {
      // Ya está fuera de circulación: no hay nada que pedir.
      return NextResponse.json({ ok: true, alreadyRemoved: true }, { status: 200 });
    }

    // Un mismo video no se pide dos veces mientras el fotógrafo no responda.
    const yaPedido = await prisma.videoRemovalRequest.findFirst({
      where: { videoId, status: "PENDING", requesterEmail: data.requesterEmail },
      select: { id: true },
    });
    if (yaPedido) {
      return NextResponse.json({ ok: true, duplicated: true }, { status: 200 });
    }

    const creada = await prisma.videoRemovalRequest.create({
      data: {
        albumId: data.albumId,
        videoId,
        photographerId: video.album.userId,
        requesterName: data.requesterName,
        requesterEmail: data.requesterEmail,
        requesterPhone: data.requesterPhone,
        reason: data.reason,
        declarationOk: true,
      },
      select: { id: true },
    });

    console.info("[video-removal] pedido de baja", {
      id: creada.id,
      videoId,
      albumId: data.albumId,
    });

    return NextResponse.json({ ok: true, id: creada.id }, { status: 201 });
  } catch (err: unknown) {
    console.error("[video-removal] fatal", err);
    return NextResponse.json(
      { error: "No pudimos registrar el pedido" },
      { status: 500 }
    );
  }
}
