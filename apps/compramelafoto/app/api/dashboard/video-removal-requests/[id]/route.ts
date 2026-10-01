import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purgeVideoPublicAssets } from "@/lib/videos/video-cleanup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PATCH /api/dashboard/video-removal-requests/[id]
 *
 * El fotógrafo aprueba o rechaza un pedido de baja de video.
 *
 * Aprobar saca el video **entero** de circulación: no se puede recortar a una
 * persona de una escena en movimiento. Además de los archivos públicos se
 * borran **las caras indexadas en Rekognition**, que no es optativo: si alguien
 * pidió salir del video, sus datos biométricos no pueden quedar guardados.
 *
 * El archivo original se conserva, igual que con las fotos.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const requestId = parseInt(id, 10);
    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const action = String(body.action ?? "");
    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json(
        { error: "action debe ser APPROVE o REJECT" },
        { status: 400 }
      );
    }

    const photographerId = Number(body.photographerId);
    if (!Number.isFinite(photographerId) || photographerId <= 0) {
      return NextResponse.json({ error: "photographerId es requerido" }, { status: 400 });
    }

    const decisionNote =
      typeof body.decisionNote === "string" ? body.decisionNote.trim() : "";

    const pedido = await prisma.videoRemovalRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        photographerId: true,
        videoId: true,
        video: { select: { id: true, isRemoved: true } },
      },
    });

    if (!pedido) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    // El fotógrafo sólo decide sobre lo suyo.
    if (pedido.photographerId !== photographerId) {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    if (pedido.status !== "PENDING") {
      return NextResponse.json(
        { error: "Este pedido ya fue procesado" },
        { status: 400 }
      );
    }

    const now = new Date();
    const nuevoEstado = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const actualizado = await prisma.videoRemovalRequest.update({
      where: { id: requestId },
      data: {
        status: nuevoEstado,
        decidedAt: now,
        decidedByUserId: photographerId,
        decisionNote: decisionNote || null,
      },
      include: {
        album: { select: { id: true, title: true, publicSlug: true } },
        video: { select: { id: true, title: true, isRemoved: true } },
      },
    });

    // Rechazar no toca el video: sigue disponible como estaba.
    if (action === "APPROVE" && !pedido.video?.isRemoved) {
      try {
        const r = await purgeVideoPublicAssets(
          prisma,
          pedido.videoId,
          `Baja aprobada (pedido #${requestId})`
        );
        console.info("[video-removal] aprobado", {
          requestId,
          videoId: pedido.videoId,
          ...r,
        });
      } catch (err: unknown) {
        // El pedido ya quedó aprobado: se avisa y no se rompe la respuesta,
        // pero queda el log para poder rehacer la baja a mano.
        console.error("[video-removal] aprobado pero falló la baja del video", {
          requestId,
          videoId: pedido.videoId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json(actualizado, { status: 200 });
  } catch (err: unknown) {
    console.error("[dashboard/video-removal-requests PATCH] fatal", err);
    return NextResponse.json(
      { error: "No pudimos procesar el pedido" },
      { status: 500 }
    );
  }
}
