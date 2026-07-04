import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/pricing/pricing-engine";
import { isAlbumComplete, isAlbumPubliclyAccessible } from "@/lib/album-helpers";
import { getAuthUser } from "@/lib/auth";

function normalizePercent(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(100, Math.max(0, parsed));
}


/**
 * POST /api/a/[id]/orders
 * Crea un pedido de álbum con fotos digitales e impresas.
 * Body: { buyerEmail, buyerName?, buyerPhone?, items: [{ fileKey, tipo, size?, finish?, quantity?, priceCents }] } (pesos)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } | Promise<{ id: string }> }
) {
  try {
    const { id } = await Promise.resolve(params);
    const albumId = parseInt(id, 10);
    if (!Number.isFinite(albumId)) {
      return NextResponse.json({ error: "ID de álbum inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { buyerName, buyerPhone, items } = body;
    const rawBuyerEmail = ((body.buyerEmail ?? "") as string).toString();
    const normalizedBuyerEmail = rawBuyerEmail.trim().toLowerCase();
    const rawBuyerPhone = ((buyerPhone ?? "") as string).toString().trim();

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

    // Verificar que el álbum existe
    let album: any;
    try {
      album = await prisma.album.findUnique({
        where: { id: albumId },
        select: {
          id: true,
          userId: true,
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

    if (!isAlbumComplete(album)) {
      return NextResponse.json({ error: "Álbum no disponible" }, { status: 404 });
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

    // Crear un mapa de fileKey -> photo (las "copias" del carrito usan fileKey con sufijo _copy_*; se resuelven al originalKey)
    const fileKeyToPhoto = new Map<string, { id: number; uploaderId: number | null }>();
    album.photos.forEach((photo: { id: number; originalKey: string; userId?: number | null }) => {
      const uploaderId = photo.userId ?? album.userId ?? null;
      fileKeyToPhoto.set(photo.originalKey, { id: photo.id, uploaderId });
    });
    const resolveFileKey = (fileKey: string): string => {
      const m = fileKey.match(/^(.+)_copy_\d+$/);
      return m ? m[1] : fileKey;
    };

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

    // Crear el pedido
    const baseData: any = {
      albumId,
      buyerEmail: normalizedBuyerEmail,
      buyerUserId: authUser?.id ?? null,
      buyerPhone: rawBuyerPhone || null,
      totalCents: Math.round(totals.displayTotalCents),
      status: "PENDING",
      items: {
        create: orderItemsData,
      },
      pricingSnapshot: totals.snapshot,
    };

    if (extensionSurchargeCents > 0) {
      baseData.extensionSurchargeCents = extensionSurchargeCents;
    }

    let order;
    try {
      order = await prisma.order.create({
        data: baseData,
        include: { items: { include: { photo: true } } },
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
      if (fallbackData !== baseData) {
        order = await prisma.order.create({
          data: fallbackData,
          include: { items: { include: { photo: true } } },
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
        const tag = `ALBUM_ORDER:${order.id}`;
        const existingPrintOrder = await prisma.printOrder.findFirst({
          where: { tags: { has: tag } },
          select: { id: true },
        });
        if (!existingPrintOrder) {
          const totalPrint = printItems.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);
          const pickupBy = album.pickupBy === "PHOTOGRAPHER" ? "PHOTOGRAPHER" : "CLIENT";
          await prisma.printOrder.create({
            data: {
              photographerId: album.userId ?? null,
              // Labs no habilitados: el pedido debe quedar para el fotógrafo
              labId: null,
              pickupBy: "PHOTOGRAPHER",
              customerName: buyerName ? String(buyerName).trim() : null,
              customerEmail: normalizedBuyerEmail,
              customerPhone: rawBuyerPhone || null,
              currency: "ARS",
              total: Math.round(totalPrint),
              status: "CREATED",
              paymentStatus: "PENDING",
              tags: [tag],
              internalNotes: `Generado desde pedido de álbum #${order.id}`,
              pricingSnapshot: totals.snapshot as Prisma.InputJsonValue,
              items: {
                create: printItems,
              },
            },
          });
        }
      }
    } catch (err: any) {
      console.error("Error creando PrintOrder espejo para pedido de álbum:", err);
    }

    // Crear preferencia de pago en Mercado Pago
    try {
      const { createPreference } = await import("@/lib/mercadopago");
      // Usar el total persistido del pedido para evitar desfasajes
      const totalArs = Math.round(order.totalCents);
      
      let accessTokenOverride: string | undefined;
      let tokenSource = "global";
      if (album?.userId) {
        const photographer = await prisma.user.findUnique({
          where: { id: album.userId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "album_owner_oauth";
        }
      }

      console.log("ORDER MP: creando preferencia", { orderId: order.id, tokenSource });

      const marketplaceFee = Math.round(Number(totals.marketplaceFeeCents || 0));
      const hasPrint = order.items.some((it) => it.productType === "PRINT");
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
