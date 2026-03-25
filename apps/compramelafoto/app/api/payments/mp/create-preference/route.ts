import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPreference, type OrderType } from "@/lib/mercadopago";
import { feeFromTotal } from "@/lib/pricing/fee-formula";
import { resolvePlatformCommissionPercent } from "@/lib/services/commissionService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    const orderType = (body.orderType || "PRINT_ORDER") as OrderType;

    if (!Number.isFinite(orderId)) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    let title: string;
    let total: number;
  let marketplaceFee: number | undefined;
  let component: "DIGITAL" | "PRINT" = "PRINT";
    let accessTokenOverride: string | undefined;
    let tokenSource = "global";

    if (orderType === "PRECOMPRA_ORDER") {
      const order = await prisma.preCompraOrder.findUnique({
        where: { id: orderId },
        include: { album: { select: { userId: true } } },
      });

      if (!order) {
        return NextResponse.json({ error: "Pedido de pre-venta no encontrado" }, { status: 404 });
      }

      const totalArs = Math.round(order.totalCents / 100);
      if (!totalArs || totalArs <= 0) {
        return NextResponse.json({ error: "El pedido tiene un total inválido" }, { status: 400 });
      }

      title = `Pre-venta escolar - Pedido #${order.id}`;
      total = totalArs;
      component = "PRINT";
      const platformPercent = await resolvePlatformCommissionPercent({
        photographerId: order.album?.userId ?? null,
      });
      marketplaceFee = Math.round(feeFromTotal(order.totalCents, platformPercent) / 100);

      if (order.album?.userId) {
        const photographer = await prisma.user.findUnique({
          where: { id: order.album.userId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "user_oauth";
        } else {
          return NextResponse.json(
            { error: "El dueño del álbum debe conectar Mercado Pago para recibir los pagos.", code: "MP_NOT_CONNECTED" },
            { status: 400 }
          );
        }
      }
    } else if (orderType === "PRINT_ORDER") {
      const order = await prisma.printOrder.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Pedido de impresión no encontrado" }, { status: 404 });
      }

      if (!order.total || order.total <= 0) {
        console.error("CREATE PREFERENCE: Pedido con total inválido", { orderId, total: order.total });
        return NextResponse.json(
          { error: "El pedido tiene un total inválido", orderId, total: order.total },
          { status: 400 }
        );
      }

      title = `Impresión de fotos - Pedido #${order.id}`;
      total = order.total;
    let marketplaceFeeCents = Number((order as any)?.pricingSnapshot?.marketplaceFeeCents ?? 0) || 0;
    if (marketplaceFeeCents <= 0 && order.total) {
      const snap = ((order as any).pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) marketplaceFeeCents = feeFromTotal(Number(order.total), pct);
    }
    marketplaceFee = Math.round(marketplaceFeeCents);
    component = "PRINT";
      const photographerIdPrint = order.photographerId ?? null;
      // Si el vendedor es referidor, descontar su saldo de comisiones del fee de esta venta
      if (photographerIdPrint != null && marketplaceFeeCents > 0) {
        const referralBalanceAgg = await prisma.referralEarning.aggregate({
          where: {
            attribution: { referrerUserId: photographerIdPrint },
            paidOutAt: null,
            reversedAt: null,
            appliedAt: null,
          },
          _sum: { referralAmountCents: true },
        });
        const referralBalanceCents = referralBalanceAgg._sum.referralAmountCents ?? 0;
        if (referralBalanceCents > 0) {
          const discountCents = Math.min(marketplaceFeeCents, referralBalanceCents);
          marketplaceFeeCents = Math.max(0, marketplaceFeeCents - discountCents);
          marketplaceFee = Math.round(marketplaceFeeCents);
          await prisma.printOrder.update({
            where: { id: orderId },
            data: { referralFeeDiscountCents: discountCents },
          });
        }
      }
      if (order.photographerId) {
        const photographer = await prisma.user.findUnique({
          where: { id: order.photographerId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "user_oauth";
        }
      }
      if (!accessTokenOverride && order.labId != null) {
        const lab = await prisma.lab.findUnique({
          where: { id: order.labId },
          select: { mpAccessToken: true },
        });
        if (lab?.mpAccessToken) {
          accessTokenOverride = lab.mpAccessToken;
          tokenSource = "lab_oauth";
        }
      }
      // La plataforma siempre cobra el 100% del fee (marketplace_fee). La parte del referidor
      // se registra en ReferralEarning en el webhook y puede pagarse al referidor por otro medio
      // (MP solo permite split en 2 partes: vendedor + marketplace; no hay tercer receptor en la misma transacción).
    } else {
      // ALBUM_ORDER
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return NextResponse.json({ error: "Pedido de álbum no encontrado" }, { status: 404 });
      }

      title = `Compra de fotos - Pedido #${order.id}`;
      total = order.totalCents;
    let marketplaceFeeCentsAlbum = Number((order as any)?.pricingSnapshot?.marketplaceFeeCents ?? 0) || 0;
    if (marketplaceFeeCentsAlbum <= 0 && order.totalCents) {
      const snap = ((order as any).pricingSnapshot ?? {}) as Record<string, unknown>;
      const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
      if (pct > 0) marketplaceFeeCentsAlbum = feeFromTotal(Number(order.totalCents), pct);
    }
    marketplaceFee = Math.round(marketplaceFeeCentsAlbum);
    const hasPrint = order.items.some((it: any) => it.productType === "PRINT");
    component = hasPrint ? "PRINT" : "DIGITAL";
      const album = await prisma.album.findUnique({
        where: { id: order.albumId },
        select: { userId: true },
      });
      const photographerIdAlbum = album?.userId ?? null;
      if (album?.userId) {
        const photographer = await prisma.user.findUnique({
          where: { id: album.userId },
          select: { mpAccessToken: true },
        });
        if (photographer?.mpAccessToken) {
          accessTokenOverride = photographer.mpAccessToken;
          tokenSource = "user_oauth";
        } else {
          // Sin MP conectado, la preferencia se crearía con token de la plataforma y el dinero
          // iría a la cuenta de la app, no a la del fotógrafo. Exigir MP conectado.
          return NextResponse.json(
            {
              error:
                "El dueño del álbum debe conectar Mercado Pago para recibir los pagos. Conectá Mercado Pago en Configuración / Datos para cobro.",
              code: "MP_NOT_CONNECTED",
            },
            { status: 400 }
          );
        }
      }
      // Descontar saldo de referidos del dueño del álbum del fee de esta venta
      if (photographerIdAlbum != null && marketplaceFeeCentsAlbum > 0) {
        const referralBalanceAgg = await prisma.referralEarning.aggregate({
          where: {
            attribution: { referrerUserId: photographerIdAlbum },
            paidOutAt: null,
            reversedAt: null,
            appliedAt: null,
          },
          _sum: { referralAmountCents: true },
        });
        const referralBalanceCents = referralBalanceAgg._sum.referralAmountCents ?? 0;
        if (referralBalanceCents > 0) {
          const discountCents = Math.min(marketplaceFeeCentsAlbum, referralBalanceCents);
          marketplaceFeeCentsAlbum = Math.max(0, marketplaceFeeCentsAlbum - discountCents);
          marketplaceFee = Math.round(marketplaceFeeCentsAlbum);
          await prisma.order.update({
            where: { id: orderId },
            data: { referralFeeDiscountCents: discountCents },
          });
        }
      }
    }

    console.log("CREATE PREFERENCE: Creando preferencia MP", {
      orderId,
      orderType,
      title,
      total,
      tokenSource,
    });

    // Crear preferencia usando la librería centralizada
    const { initPoint, preferenceId } = await createPreference(
      {
        title,
        total,
        marketplaceFee,
        externalReference: String(orderId),
        metadata: {
          orderType,
          orderId,
          component,
        },
      },
      { accessTokenOverride }
    );

    console.log("CREATE PREFERENCE: Preferencia creada exitosamente", {
      orderId,
      preferenceId,
      initPoint: initPoint?.substring(0, 50) + "...",
    });

    // Actualizar el pedido según su tipo
    if (orderType === "PRINT_ORDER") {
      await prisma.printOrder.update({
        where: { id: orderId },
        data: {
          paymentProvider: "MP",
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
          paymentStatus: "PENDING",
        },
      });
    } else if (orderType === "PRECOMPRA_ORDER") {
      await prisma.preCompraOrder.update({
        where: { id: orderId },
        data: {
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
        },
      });
    } else {
      // ALBUM_ORDER
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: "PENDING",
          mpInitPoint: initPoint,
          mpPreferenceId: preferenceId,
        },
      });
    }

    return NextResponse.json(
      {
        orderId,
        orderType,
        initPoint,
        preferenceId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("CREATE PREFERENCE ERROR >>>", err);
    const errorMessage = err?.message || String(err) || "Error desconocido";
    const errorStack = err?.stack || err?.toString() || "";
    const errorCode = err?.code || err?.name || "UNKNOWN_ERROR";
    console.error("CREATE PREFERENCE ERROR DETAILS:", {
      message: errorMessage,
      stack: errorStack.substring(0, 500),
      errorCode,
      errorType: typeof err,
      errString: String(err),
      err,
    });
    
    // Asegurar que siempre devolvemos JSON válido
    try {
      return NextResponse.json(
        { 
          error: "Error creando preferencia", 
          detail: errorMessage,
          code: errorCode,
          ...(process.env.NODE_ENV !== "production" && { stack: errorStack.substring(0, 500) })
        },
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    } catch (jsonError: any) {
      // Si incluso el JSON falla, devolver texto plano pero con Content-Type JSON
      console.error("CRITICAL: Failed to create JSON error response:", jsonError);
      return new NextResponse(
        JSON.stringify({ 
          error: "Error creando preferencia", 
          detail: errorMessage 
        }),
        { 
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
  }
}
