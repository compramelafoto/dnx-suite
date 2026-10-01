import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateDownloadToken } from "@/lib/download-tokens";
import { getSignedUrlForFile } from "@/lib/r2-client";
import {
  canDownloadPurchasedVideo,
  isVideoFilePurged,
} from "@/lib/videos/video-download-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/descargas/[token]/videos/[videoId]
 *
 * Entrega el video ORIGINAL (sin marca de agua, calidad completa) a quien lo
 * compró. Redirige a una URL firmada de R2 con vencimiento corto, así el
 * archivo nunca queda accesible con un link permanente.
 *
 * Las reglas de acceso viven en `lib/videos/video-download-access` y tienen
 * tests propios.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; videoId: string }> }
) {
  try {
    const { token, videoId: videoIdRaw } = await Promise.resolve(params);
    const videoId = parseInt(videoIdRaw, 10);
    if (!Number.isFinite(videoId)) {
      return NextResponse.json({ error: "Video inválido" }, { status: 400 });
    }

    const validation = await validateDownloadToken(token);
    if (!validation.valid || !validation.token) {
      return NextResponse.json(
        { error: validation.error || "Link de descarga no válido" },
        { status: 403 }
      );
    }

    const orderId = validation.token.orderId;
    if (orderId == null) {
      return NextResponse.json({ error: "Link de descarga no válido" }, { status: 403 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        videoItems: { select: { videoId: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const video = await prisma.videoAsset.findUnique({
      where: { id: videoId },
      select: { id: true, originalKey: true },
    });

    const verdict = canDownloadPurchasedVideo({
      orderStatus: String(order.status),
      tokenOrderId: orderId,
      orderId: order.id,
      boughtVideoIds: order.videoItems.map((i) => i.videoId),
      requestedVideoId: videoId,
      videoPurged: !video || isVideoFilePurged(video),
    });

    if (!verdict.allowed) {
      return NextResponse.json({ error: verdict.reason }, { status: 403 });
    }

    // 10 minutos: alcanza para empezar la descarga y no deja un link que
    // sirva para siempre si alguien lo reenvía.
    //
    // El archivo baja con el nombre que tiene en R2 (un identificador), no con
    // el original del fotógrafo: poner un nombre amable pide tocar el cliente
    // de R2, que es compartido con las fotos. Queda como mejora cosmética.
    const signedUrl = await getSignedUrlForFile(video!.originalKey, 600);

    console.info("[video-download] entregado", { orderId, videoId });

    return NextResponse.redirect(signedUrl);
  } catch (err: unknown) {
    console.error("[video-download] fatal", err);
    return NextResponse.json({ error: "No pudimos preparar la descarga" }, { status: 500 });
  }
}
