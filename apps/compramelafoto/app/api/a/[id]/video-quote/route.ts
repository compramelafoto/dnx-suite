import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { loadCartVideos } from "@/lib/videos/create-video-order";
import { quoteVideoCart } from "@/lib/videos/video-cart";
import { formatVideoPriceArs } from "@/lib/videos/public-video-price";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/a/[id]/video-quote
 *
 * Cuánto suman los videos del carrito. Lo calcula el servidor con la MISMA
 * función que cobra, así lo que el cliente ve en el resumen y lo que termina
 * pagando no pueden divergir.
 *
 * Devuelve además los rechazados para poder decirle por qué un video que había
 * elegido ya no está.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ items: [], rejected: [], clientTotalArs: 0 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const videoIds = Array.isArray(body?.videoIds)
      ? body.videoIds
          .map((n: unknown) => parseInt(String(n), 10))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [];

    if (videoIds.length === 0) {
      return NextResponse.json({ items: [], rejected: [], clientTotalArs: 0 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        userId: true,
        isPublic: true,
        isHidden: true,
        isTest: true,
        selectedLabId: true,
      },
    });
    if (!album || !isAlbumPubliclyAccessible(album)) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 403 });
    }

    const feePercent = await resolveClientMarketplaceFeePercent({
      photographerId: album.userId,
      labId: album.selectedLabId ?? null,
    });

    const videos = await loadCartVideos(prisma, albumId, videoIds);
    const quote = quoteVideoCart(videos, feePercent);

    return NextResponse.json({
      items: quote.items.map((i) => ({
        videoId: i.videoId,
        title: i.videoTitle,
        subtotalArs: i.subtotalArs,
        subtotalLabel: formatVideoPriceArs(i.subtotalArs),
      })),
      rejected: quote.rejected,
      clientTotalArs: quote.clientTotalArs,
      clientTotalLabel: formatVideoPriceArs(quote.clientTotalArs),
    });
  } catch (err: unknown) {
    console.error("[video-quote] fatal", err);
    return NextResponse.json({ error: "No pudimos calcular el total" }, { status: 500 });
  }
}
