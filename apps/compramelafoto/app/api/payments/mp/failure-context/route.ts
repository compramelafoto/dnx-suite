import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  getAlbumOrderFailureContext,
  isAlbumOrderRecoveryScope,
} from "@/lib/mercadopago/album-order-payment-recovery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseOrderId(raw: string | null): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * GET /api/payments/mp/failure-context?orderId=&orderType=ALBUM_ORDER&buyerEmail=
 * Contexto de UI para /pago/failure (álbum y preventa pack moderna). Sin secrets de MP.
 */
export async function GET(req: NextRequest) {
  try {
    const orderId = parseOrderId(req.nextUrl.searchParams.get("orderId"));
    const orderType = req.nextUrl.searchParams.get("orderType");
    const buyerEmail = req.nextUrl.searchParams.get("buyerEmail");

    if (!orderId) {
      return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
    }

    if (!isAlbumOrderRecoveryScope(orderType)) {
      return NextResponse.json(
        {
          error: "Solo se admite orderType ALBUM_ORDER en esta pantalla.",
          code: "UNSUPPORTED_ORDER_TYPE",
        },
        { status: 400 }
      );
    }

    const authUser = await getAuthUser();
    const result = await getAlbumOrderFailureContext(orderId, authUser, buyerEmail);

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

    return NextResponse.json(result.context, { status: 200 });
  } catch (err: unknown) {
    console.error("GET /api/payments/mp/failure-context", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
