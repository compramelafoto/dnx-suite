import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  isAlbumOrderRecoveryScope,
  retryAlbumOrderPayment,
} from "@/lib/mercadopago/album-order-payment-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/payments/mp/retry-payment
 * Reintento de pago para ALBUM_ORDER (checkout álbum y preventa pack moderna).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    const orderType = typeof body.orderType === "string" ? body.orderType : "";
    const buyerEmail = typeof body.buyerEmail === "string" ? body.buyerEmail : undefined;
    const forceRegenerate = body.forceRegenerate === true;

    if (!Number.isFinite(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    if (!isAlbumOrderRecoveryScope(orderType)) {
      return NextResponse.json(
        {
          error: "Solo se admite orderType ALBUM_ORDER.",
          code: "UNSUPPORTED_ORDER_TYPE",
        },
        { status: 400 }
      );
    }

    const authUser = await getAuthUser();
    const result = await retryAlbumOrderPayment(orderId, authUser, buyerEmail, {
      forceRegenerate,
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...(result.retryRequiresEmail ? { retryRequiresEmail: true } : {}),
        },
        { status: result.httpStatus }
      );
    }

    return NextResponse.json(
      {
        initPoint: result.initPoint,
        reused: result.reused,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error("POST /api/payments/mp/retry-payment", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
