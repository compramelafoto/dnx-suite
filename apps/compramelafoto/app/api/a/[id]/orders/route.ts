import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckoutPaymentSource, OrderOrigin, Prisma } from "@prisma/client";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { isPreventaPacksV1Enabled } from "@/lib/preventa-canjeable/feature-flag";
import {
  buildStandardLinesFromAlbumCheckout,
  mergeStandardAlbumCheckoutPricingSnapshotV1,
} from "@/lib/preventa-canjeable/pricing-snapshot-v1";
import { isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import {
  albumSalesNotReadyResponse,
  isAlbumReadyToSellForCheckout,
} from "@/lib/albums/album-sales-readiness-server";
import { getAuthUser } from "@/lib/auth";
import { denyIfTestAlbumNotOwnerPreview } from "@/lib/public-album-test-access";
import { albumPhotoFileKey, stripCartCopySuffix } from "@/lib/album-photo-ref";
import { buildAlbumOrderMercadoPagoCheckoutSplit } from "@/lib/event-organizer-commission-mp-checkout";
import { resolveAlbumOrderMercadoPagoCredentials } from "@/lib/mercadopago/resolve-album-order-mp-credentials";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";
import { applyAndPersistSellerReferralDiscount } from "@/lib/referral/referral-marketplace-fee";
import { registerAuditEvent, getRequestMetadata } from "@/lib/antifraud/audit";
import { buildCheckoutTermsAcceptanceMetadata } from "@/lib/legal/checkout-terms";
import {
  createAlbumOrderPrintOrderMirror,
  syncAlbumOrderPrintMirrorContact,
} from "@/lib/orders/create-album-order-print-order-mirror";

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}

function normalizeIdempotencyKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function buildOrderItemsSignature(
  rows: Array<{
    photoId: number;
    productType: string;
    size?: string | null;
    finish?: string | null;
    quantity: number;
    priceCents: number;
    subtotalCents: number;
  }>
): string {
  return rows
    .map((row) =>
      [
        row.photoId,
        row.productType,
        row.size ?? "",
        row.finish ?? "",
        row.quantity,
        row.priceCents,
        row.subtotalCents,
      ].join(":")
    )
    .sort()
    .join("|");
}


/**
 * POST /api/a/[id]/orders
 * Crea un pedido de álbum con fotos digitales e impresas.
 * Body: { buyerEmail, buyerName?, buyerPhone?, items: [{ fileKey, tipo, size?, finish?, quantity?, priceCents }] } (pesos)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { buyerName, buyerPhone, items } = body;
    const idempotencyKey =
      normalizeIdempotencyKey(req.headers.get("x-idempotency-key")) ??
      normalizeIdempotencyKey(body?.idempotencyKey);
    const rawPack = body.faceBulkPackPhotoIds;
    const faceBulkPackPhotoIds = Array.isArray(rawPack)
      ? rawPack
          .map((n: unknown) => parseInt(String(n), 10))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      : undefined;
    const rawBuyerEmail = ((body.buyerEmail ?? "") as string).toString();
    const normalizedBuyerEmail = rawBuyerEmail.trim().toLowerCase();
    const rawBuyerPhone = ((buyerPhone ?? "") as string).toString().trim();
    const trimmedBuyerName = buyerName ? String(buyerName).trim() || null : null;

    if (!normalizedBuyerEmail) {
      return NextResponse.json({ error: "buyerEmail es requerido" }, { status: 400 });
    }

    const { isValidPhoneForPurchase } = await import("@/lib/phone-validation");
    if (!rawBuyerPhone) {
      return NextResponse.json({ error: "El teléfono de WhatsApp es obligatorio para contactarte" }, { status: 400 });
    }
    if (!isValidPhoneForPurchase(rawBuyerPhone)) {
      return NextResponse.json({
        error: "Ingresá un número de teléfono o WhatsApp (mínimo 8 dígitos)",
      }, { status: 400 });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items debe ser un array no vacío" }, { status: 400 });
    }

    if (body.termsAccepted !== true) {
      return NextResponse.json(
        { error: "Para continuar necesitás aceptar los términos." },
        { status: 400 }
      );
    }

    // Verificar que el álbum existe
    let album: any;
    try {
      album = await prisma.album.findUnique({
        where: { id: albumId },
        select: {
          id: true,
          userId: true,
          eventId: true,
          isTest: true,
          isPublic: true,
          isHidden: true,
          enablePrintedPhotos: true,
          enableDigitalPhotos: true,
          selectedLabId: true,
          albumProfitMarginPercent: true,
          pickupBy: true,
          digitalPhotoPriceCents: true,
          termsAcceptedAt: true,
          termsVersion: true,
          photos: {
            where: { isRemoved: false },
            select: { id: true, originalKey: true, userId: true },
          },
        },
      });
    } catch (err: any) {
      // Si falla por isRemoved, cargar todas y filtrar manualmente
      if (err?.message?.includes("isRemoved")) {
        album = await prisma.album.findUnique({
          where: { id: albumId },
          select: {
            id: true,
            userId: true,
            eventId: true,
            isTest: true,
            isPublic: true,
            isHidden: true,
            enablePrintedPhotos: true,
            enableDigitalPhotos: true,
            selectedLabId: true,
            albumProfitMarginPercent: true,
            pickupBy: true,
            digitalPhotoPriceCents: true,
            termsAcceptedAt: true,
            termsVersion: true,
            photos: {
              select: { id: true, originalKey: true, isRemoved: true, userId: true },
            },
          },
        });
        if (album && album.photos) {
          album.photos = album.photos.filter((p: { id: number; originalKey: string; isRemoved: boolean }) => !p.isRemoved);
        }
      } else {
        throw err;
      }
    }

    if (!album) {
      return NextResponse.json({ error: "Álbum no encontrado" }, { status: 404 });
    }

    const testDenyOrders = await denyIfTestAlbumNotOwnerPreview({
      isTest: album.isTest,
      userId: album.userId,
    });
    if (testDenyOrders) return testDenyOrders;

    const salesReady = await isAlbumReadyToSellForCheckout({
      userId: album.userId,
      enableDigitalPhotos: album.enableDigitalPhotos,
      enablePrintedPhotos: album.enablePrintedPhotos,
      digitalPhotoPriceCents: album.digitalPhotoPriceCents,
      albumProfitMarginPercent: album.albumProfitMarginPercent,
      selectedLabId: album.selectedLabId,
      pickupBy: album.pickupBy,
      printPricingSource: album.printPricingSource,
      termsAcceptedAt: album.termsAcceptedAt,
      termsVersion: album.termsVersion,
    });
    if (!salesReady) {
      return albumSalesNotReadyResponse();
    }

    const authUser = await getAuthUser();

    if (!isAlbumPubliclyAccessible(album)) {
      const isOwner = authUser?.id === album.userId;
      const hasAccess = authUser
        ? await prisma.albumAccess.findUnique({
            where: { albumId_userId: { albumId, userId: authUser.id } },
          })
        : null;
      if (!isOwner && !hasAccess) {
        return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
      }
    }

    // Mapa fileKey -> photo: referencia opaca `photo:{id}` (cliente) y originalKey R2 (sesiones antiguas).
    const fileKeyToPhoto = new Map<string, { id: number; uploaderId: number | null }>();
    album.photos.forEach((photo: { id: number; originalKey: string; userId?: number | null }) => {
      const uploaderId = photo.userId ?? album.userId ?? null;
      const row = { id: photo.id, uploaderId };
      fileKeyToPhoto.set(photo.originalKey, row);
      fileKeyToPhoto.set(albumPhotoFileKey(photo.id), row);
    });
    const resolveFileKey = (fileKey: string): string => stripCartCopySuffix(fileKey);

    const normalizedItems = items.map((item: any) => ({
      fileKey: typeof item.fileKey === "string" ? resolveFileKey(item.fileKey) : item.fileKey,
      originalName: typeof item.originalName === "string" ? item.originalName : null,
      size: item.size ?? null,
      finish: item.finish ?? item.acabado ?? null,
      quantity: item.quantity,
      tipo: item.tipo,
      productId: item.productId ?? null,
      productName: item.productName ?? null,
      includedWithPrint: Boolean(item.includedWithPrint),
      uploaderId: item.uploaderId ?? null,
      uploaderDigitalPriceCents: item.uploaderDigitalPriceCents ?? null,
    }));

    const totals = await computeCheckoutTotals({
      flow: "ALBUM_ORDER",
      albumId,
      items: normalizedItems,
      faceBulkPackPhotoIds,
    });

    if (totals.displayTotalCents <= 0) {
      return NextResponse.json({ error: "El total debe ser mayor a 0" }, { status: 400 });
    }

    const extensionSurchargeCents = Number(
      (totals.snapshot as any)?.extensionSurchargeCents ?? 0
    );

    const orderItemsData: Array<{
      photoId: number;
      productType: "DIGITAL" | "PRINT";
      size?: string | null;
      finish?: string | null;
      quantity: number;
      priceCents: number;
      subtotalCents: number;
    }> = [];

    totals.items.forEach((computed) => {
      const original = normalizedItems[computed.inputIndex];
      const fileKey = original?.fileKey;
      if (!fileKey || typeof fileKey !== "string") {
        throw new Error("fileKey es requerido en cada item");
      }
      const photoData = fileKeyToPhoto.get(fileKey);
      if (!photoData?.id || !Number.isFinite(photoData.id)) {
        throw new Error(`Foto no encontrada: ${fileKey}`);
      }

      const isDigital = original?.tipo === "digital" || original?.size === "DIGITAL" || original?.includedWithPrint;
      // Siempre crear OrderItem para digitales (incluso si $0 incluido con impresión) para que se genere el ZIP
      const rawFinish = original?.finish;
      const finishValue =
        isDigital || rawFinish == null || String(rawFinish).trim() === ""
          ? null
          : String(rawFinish).trim().toUpperCase();
      orderItemsData.push({
        photoId: photoData.id,
        productType: isDigital ? "DIGITAL" : "PRINT",
        size: isDigital ? null : (original?.size ?? null)?.trim() || null,
        finish: finishValue as string | null,
        quantity: computed.quantity,
        priceCents: computed.unitPriceCents,
        subtotalCents: computed.subtotalCents,
      });
    });

    const marketplaceFeeCents = Math.round(Number(totals.marketplaceFeeCents) || 0);
    const engineSnapshot = totals.snapshot as Record<string, unknown>;
    let pricingSnapshotForOrder: Prisma.InputJsonValue =
      totals.snapshot as Prisma.InputJsonValue;
    const orderV1Fields: Partial<{
      origin: OrderOrigin;
      checkoutPaymentSource: CheckoutPaymentSource;
    }> = {};
    if (isPreventaPacksV1Enabled()) {
      const v1Lines = buildStandardLinesFromAlbumCheckout(
        orderItemsData.map((r) => ({ subtotalCents: r.subtotalCents })),
        marketplaceFeeCents
      );
      pricingSnapshotForOrder = mergeStandardAlbumCheckoutPricingSnapshotV1(
        engineSnapshot,
        {
          marketplaceFeeCents,
          displayTotalCents: totals.displayTotalCents,
          lines: v1Lines,
        }
      ) as Prisma.InputJsonValue;
      orderV1Fields.origin = OrderOrigin.STANDARD_CHECKOUT;
      orderV1Fields.checkoutPaymentSource = CheckoutPaymentSource.MERCADO_PAGO;
    }

    // Crear el pedido
    const baseData: any = {
      albumId,
      buyerEmail: normalizedBuyerEmail,
      buyerUserId: authUser?.id ?? null,
      buyerName: trimmedBuyerName,
      buyerPhone: rawBuyerPhone || null,
      totalCents: Math.round(totals.displayTotalCents),
      status: "PENDING",
      items: {
        create: orderItemsData,
      },
      pricingSnapshot: pricingSnapshotForOrder,
      ...orderV1Fields,
    };

    if (extensionSurchargeCents > 0) {
      baseData.extensionSurchargeCents = extensionSurchargeCents;
    }

    const mpCredsPrecheck = await resolveAlbumOrderMercadoPagoCredentials({
      photographerUserId: album?.userId ?? null,
      eventId: album?.eventId ?? null,
    });

    const orderItemsSignature = buildOrderItemsSignature(orderItemsData);
    const recentThreshold = new Date(Date.now() - 10 * 60 * 1000);
    const recentCandidates = await prisma.order.findMany({
      where: {
        albumId,
        buyerEmail: normalizedBuyerEmail,
        status: "PENDING",
        origin: OrderOrigin.STANDARD_CHECKOUT,
        createdAt: { gte: recentThreshold },
        totalCents: Math.round(totals.displayTotalCents),
        ...(idempotencyKey ? { preCompraPaymentRef: idempotencyKey } : {}),
      },
      orderBy: { id: "desc" },
      take: 10,
      select: {
        id: true,
        totalCents: true,
        mpInitPoint: true,
        mpPreferenceId: true,
        items: {
          select: {
            photoId: true,
            productType: true,
            size: true,
            finish: true,
            quantity: true,
            priceCents: true,
            subtotalCents: true,
          },
        },
      },
    });
    const reusableOrder = recentCandidates.find((candidate) => {
      const candidateSignature = buildOrderItemsSignature(
        candidate.items.map((item) => ({
          photoId: item.photoId,
          productType: item.productType,
          size: item.size,
          finish: item.finish,
          quantity: item.quantity,
          priceCents: item.priceCents,
          subtotalCents: item.subtotalCents,
        }))
      );
      return candidateSignature === orderItemsSignature;
    });
    if (reusableOrder) {
      if (
        !reusableOrder.mpInitPoint &&
        !mpCredsPrecheck.ok &&
        mpCredsPrecheck.code === "ORGANIZER_MP_NOT_CONNECTED"
      ) {
        return NextResponse.json(
          {
            error: mpCredsPrecheck.error,
            code: mpCredsPrecheck.code,
          },
          { status: 400 }
        );
      }
      await prisma.order.update({
        where: { id: reusableOrder.id },
        data: {
          buyerEmail: normalizedBuyerEmail,
          buyerPhone: rawBuyerPhone || null,
          buyerName: trimmedBuyerName,
        },
      });
      try {
        await syncAlbumOrderPrintMirrorContact(prisma, {
          albumOrderId: reusableOrder.id,
          customerName: trimmedBuyerName,
          customerEmail: normalizedBuyerEmail,
          customerPhone: rawBuyerPhone || null,
        });
      } catch (mirrorErr) {
        console.error("Error actualizando contacto en PrintOrder espejo:", mirrorErr);
      }
      return NextResponse.json(
        {
          id: reusableOrder.id,
          totalCents: reusableOrder.totalCents,
          initPoint: reusableOrder.mpInitPoint,
          preferenceId: reusableOrder.mpPreferenceId,
          reused: true,
        },
        { status: 200 }
      );
    }

    if (
      !mpCredsPrecheck.ok &&
      mpCredsPrecheck.code === "ORGANIZER_MP_NOT_CONNECTED"
    ) {
      return NextResponse.json(
        {
          error: mpCredsPrecheck.error,
          code: mpCredsPrecheck.code,
        },
        { status: 400 }
      );
    }

    if (idempotencyKey) {
      baseData.preCompraPaymentRef = idempotencyKey;
    }

    // Solo items: `photo: true` fuerza SELECT de todas las columnas Photo (p.ej. exifMetadataStatus)
    // y rompe staging cuando el schema Prisma adelanta a la DB.
    const orderCreateInclude = { items: true } as const;

    let order;
    try {
      order = await prisma.order.create({
        data: baseData,
        include: orderCreateInclude,
      });
    } catch (createErr: any) {
      const msg = String(createErr?.message ?? "");
      const fallbackData = { ...baseData };
      if (msg.includes("extensionSurchargeCents") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
        delete fallbackData.extensionSurchargeCents;
      }
      if (msg.includes("pricingSnapshot") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
        delete fallbackData.pricingSnapshot;
      }
      if (msg.includes("buyerUserId") && (msg.includes("Unknown argument") || msg.includes("does not exist"))) {
        delete fallbackData.buyerUserId;
      }
      if (msg.includes("buyerPhone") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
        delete fallbackData.buyerPhone;
      }
      if (msg.includes("buyerName") && (msg.includes("Unknown argument") || msg.includes("Unknown column"))) {
        delete fallbackData.buyerName;
      }
      if (fallbackData !== baseData) {
        order = await prisma.order.create({
          data: fallbackData,
          include: orderCreateInclude,
        });
      } else {
        throw createErr;
      }
    }

    // Si hay ítems impresos, crear un PrintOrder espejo para el flujo de impresión
    try {
      const printItems = totals.items
        .filter((computed) => computed.component === "PRINT")
        .map((computed) => {
          const original = normalizedItems[computed.inputIndex];
          const fileKey = String(original?.fileKey || "").trim();
          const originalNameRaw = original?.originalName || "";
          const originalName = originalNameRaw
            ? String(originalNameRaw).trim()
            : (fileKey.split("/").pop() || fileKey);
          const finishRaw = original?.finish ?? "BRILLO";
          const acabado = String(finishRaw).trim().toUpperCase() || "BRILLO";
          return {
            fileKey,
            originalName,
            size: String(original?.size || "").trim(),
            acabado,
            quantity: computed.quantity,
            unitPrice: computed.unitPriceCents,
            subtotal: computed.subtotalCents,
          };
        })
        .filter((it) => it.fileKey && it.size && Number.isFinite(it.quantity) && it.quantity > 0);

      if (printItems.length > 0) {
        await createAlbumOrderPrintOrderMirror(prisma, {
          albumOrderId: order.id,
          photographerId: album.userId ?? null,
          customerName: trimmedBuyerName,
          customerEmail: normalizedBuyerEmail,
          customerPhone: rawBuyerPhone || null,
          printItems,
          pricingSnapshot: pricingSnapshotForOrder,
        });
      }
    } catch (err: any) {
      console.error("Error creando PrintOrder espejo para pedido de álbum:", err);
    }

    const { ipAddress, userAgent } = getRequestMetadata(req);
    const termsAcceptedAt = new Date();
    await registerAuditEvent({
      actorUserId: authUser?.id ?? null,
      actorRole: authUser?.role ?? "GUEST",
      targetOrderType: "ALBUM_ORDER",
      targetOrderId: order.id,
      targetAlbumId: albumId,
      eventType: "TERMS_ACCEPTED",
      ipAddress,
      userAgent,
      metadata: {
        ...buildCheckoutTermsAcceptanceMetadata(termsAcceptedAt),
        buyerEmail: normalizedBuyerEmail,
      },
    });

    // Crear preferencia de pago en Mercado Pago
    try {
      const { createPreference } = await import("@/lib/mercadopago");
      // Usar el total persistido del pedido para evitar desfasajes
      const totalArs = Math.round(order.totalCents);

      const mpCreds = mpCredsPrecheck.ok
        ? mpCredsPrecheck
        : await resolveAlbumOrderMercadoPagoCredentials({
            photographerUserId: album?.userId ?? null,
            eventId: album?.eventId ?? null,
          });
      if (!mpCreds.ok) {
        return NextResponse.json(
          {
            id: order.id,
            totalCents: order.totalCents,
            error: "Pedido creado pero error al generar link de pago",
            mpError: mpCreds.error,
            code: mpCreds.code,
          },
          { status: 201 }
        );
      }
      const accessTokenOverride = mpCreds.accessToken;
      const tokenSource =
        mpCreds.collectorType === "ORGANIZER" ? "event_organizer_oauth" : "album_owner_oauth";

      console.log("ORDER MP: creando preferencia", {
        orderId: order.id,
        tokenSource,
        collectorType: mpCreds.collectorType,
      });

      const hasPrint = order.items.some((it) => it.productType === "PRINT");
      let marketplaceFeePlatformOnly = Math.round(Number(totals.marketplaceFeeCents || 0));
      if (album?.userId && marketplaceFeePlatformOnly > 0) {
        const referralDiscount = await applyAndPersistSellerReferralDiscount({
          sellerUserId: album.userId,
          marketplaceFeeCents: marketplaceFeePlatformOnly,
          persist: { orderType: "ALBUM_ORDER", orderId: order.id },
        });
        marketplaceFeePlatformOnly = referralDiscount.marketplaceFeeCents;
      }
      const platformPercentOrder = hasPrint
        ? await resolvePlatformCommissionPercent({
            photographerId: album.userId,
            labId: album.selectedLabId ?? null,
          })
        : await resolveClientMarketplaceFeePercent({
            photographerId: album.userId,
            labId: album.selectedLabId ?? null,
          });
      const checkoutSplit = await buildAlbumOrderMercadoPagoCheckoutSplit({
        orderId: order.id,
        albumId,
        eventId: album.eventId ?? null,
        totalPaidPesos: order.totalCents,
        extensionSurchargePesos: Number(order.extensionSurchargeCents ?? 0),
        platformPercent: platformPercentOrder,
        marketplaceFeePlatformOnlyPesos: marketplaceFeePlatformOnly,
        paymentCollectorType: mpCreds.collectorType,
      });
      const marketplaceFee = checkoutSplit.marketplaceFeePesos;
      const component = hasPrint ? "PRINT" : "DIGITAL";

      const { initPoint, preferenceId } = await createPreference(
        {
          title: `Compra de fotos - Pedido #${order.id}`,
          total: totalArs,
          marketplaceFee,
          externalReference: String(order.id),
          metadata: {
            orderType: "ALBUM_ORDER",
            orderId: order.id,
            albumId,
            component,
          },
        },
        { accessTokenOverride }
      );

      await prisma.order.update({
        where: { id: order.id },
        data: {
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
        },
      });

      return NextResponse.json(
        {
          id: order.id,
          totalCents: order.totalCents,
          initPoint,
          preferenceId,
        },
        { status: 201 }
      );
    } catch (mpError: any) {
      // Si falla la creación de preferencia, igual retornamos el pedido creado
      console.error("Error creando preferencia MP para Order:", mpError);
      return NextResponse.json(
        {
          id: order.id,
          totalCents: order.totalCents,
          error: "Pedido creado pero error al generar link de pago",
          mpError: String(mpError?.message ?? mpError),
        },
        { status: 201 }
      );
    }
  } catch (err: any) {
    console.error("POST /api/a/[id]/orders ERROR >>>", err);
    return NextResponse.json(
      { error: "Error creando pedido", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}
