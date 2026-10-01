import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference } from "@/lib/mercadopago";
import { resolveAlbumOrderMercadoPagoCredentials } from "@/lib/mercadopago/resolve-album-order-mp-credentials";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { isVideoMvpEnabled } from "@/lib/videos/video-feature-flag";
import { loadCartVideos, createVideoOrder } from "@/lib/videos/create-video-order";
import { quoteVideoCart } from "@/lib/videos/video-cart";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/a/[id]/video-orders
 *
 * Compra de videos de un álbum. Camino propio, separado del de fotos: ese
 * endpoint tiene 695 líneas con impresión, preventa y parches de schema, y
 * meter video ahí pondría en riesgo la venta de fotos.
 *
 * Lo que comparte es lo que importa: el pedido es un `Order`, así que el fee y
 * el reparto con Mercado Pago viajan por el mismo camino que las fotos.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isVideoMvpEnabled()) {
      return NextResponse.json({ error: "La venta de videos no está disponible" }, { status: 404 });
    }

    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const buyerEmail = String(body?.buyerEmail ?? "").trim().toLowerCase();
    if (!buyerEmail) {
      return NextResponse.json({ error: "Necesitamos tu email para enviarte el video" }, { status: 400 });
    }

    const buyerPhone = String(body?.buyerPhone ?? "").trim();
    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!buyerPhone || !isValidPhoneForPurchase(buyerPhone)) {
      return NextResponse.json(
        { error: "Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos)" },
        { status: 400 }
      );
    }

    if (body?.termsAccepted !== true) {
      return NextResponse.json(
        { error: "Para continuar necesitás aceptar los términos." },
        { status: 400 }
      );
    }

    const videoIds = Array.isArray(body?.videoIds)
      ? body.videoIds
          .map((n: unknown) => parseInt(String(n), 10))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    if (videoIds.length === 0) {
      return NextResponse.json({ error: "Elegí al menos un video" }, { status: 400 });
    }

    const album = await prisma.album.findUnique({
      where: { id: albumId },
      select: {
        id: true,
        userId: true,
        eventId: true,
        isTest: true,
        isPublic: true,
        isHidden: true,
        selectedLabId: true,
      },
    });
    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }
    if (!isAlbumPubliclyAccessible(album)) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 403 });
    }

    // El precio lo pone el servidor: del cliente sólo se aceptan los ids.
    const feePercent = await resolveClientMarketplaceFeePercent({
      photographerId: album.userId,
      labId: album.selectedLabId ?? null,
    });

    const videos = await loadCartVideos(prisma, albumId, videoIds);
    const quote = quoteVideoCart(videos, feePercent);

    if (!quote.payable) {
      return NextResponse.json(
        {
          error:
            quote.rejected.length > 0
              ? `No pudimos cobrar estos videos: ${quote.rejected
                  .map((r) => r.reason)
                  .join(", ")}`
              : "Los videos elegidos ya no están disponibles",
          rejected: quote.rejected,
        },
        { status: 400 }
      );
    }

    const mpCreds = await resolveAlbumOrderMercadoPagoCredentials({
      photographerUserId: album.userId ?? null,
      eventId: album.eventId ?? null,
    });
    if (!mpCreds.ok) {
      return NextResponse.json(
        { error: mpCreds.error || "El vendedor todavía no conectó Mercado Pago", code: mpCreds.code },
        { status: 409 }
      );
    }

    // Cuando cobra el organizador de un evento, el reparto tiene partes que
    // todavía no están resueltas para video. Antes que repartir mal, no vender.
    if (mpCreds.collectorType === "ORGANIZER") {
      console.warn("[video-order] bloqueado: cobro por organizador de evento", {
        albumId,
        eventId: album.eventId,
      });
      return NextResponse.json(
        {
          error:
            "Por ahora los videos de álbumes de eventos con organizador no se pueden comprar online. Escribinos y te ayudamos.",
          code: "VIDEO_ORGANIZER_SPLIT_PENDING",
        },
        { status: 409 }
      );
    }

    const { orderId } = await createVideoOrder(
      prisma,
      {
        albumId,
        videoIds,
        buyerEmail,
        buyerName: body?.buyerName ? String(body.buyerName).trim() || null : null,
        buyerPhone,
        feePercent,
        isTest: album.isTest === true,
      },
      quote
    );

    try {
      const { initPoint, preferenceId } = await createPreference(
        {
          title: `Compra de video${quote.items.length > 1 ? "s" : ""} - Pedido #${orderId}`,
          total: quote.clientTotalArs,
          marketplaceFee: quote.feeTotalArs,
          externalReference: String(orderId),
          metadata: {
            orderType: "ALBUM_ORDER",
            orderId,
            albumId,
            // Lo que distingue este pedido de uno de fotos en el webhook.
            videoOrder: true,
            videoIds: quote.items.map((i) => i.videoId),
          },
        },
        { accessTokenOverride: mpCreds.accessToken }
      );

      await prisma.order.update({
        where: { id: orderId },
        data: { mpPreferenceId: preferenceId, mpInitPoint: initPoint },
      });

      return NextResponse.json(
        {
          id: orderId,
          totalArs: quote.clientTotalArs,
          initPoint,
          preferenceId,
          items: quote.items,
          rejected: quote.rejected,
        },
        { status: 201 }
      );
    } catch (mpErr: unknown) {
      // El pedido queda creado y pendiente: el cliente puede reintentar el pago
      // sin perder lo que eligió.
      console.error("[video-order] error creando la preferencia", {
        orderId,
        error: mpErr instanceof Error ? mpErr.message : String(mpErr),
      });
      return NextResponse.json(
        {
          id: orderId,
          totalArs: quote.clientTotalArs,
          error: "Pedido creado pero no pudimos generar el link de pago. Probá de nuevo.",
        },
        { status: 201 }
      );
    }
  } catch (err: unknown) {
    console.error("[video-order] fatal", err);
    return NextResponse.json(
      { error: "No pudimos procesar la compra", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
