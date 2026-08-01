import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createStoreOrder } from "@/lib/public-store/checkout/create-store-order";
import {
  STORE_ORDER_ACCESS_COOKIE,
} from "@/lib/public-store/checkout/access-token";
import {
  StoreCheckoutError,
  storeCheckoutPublicMessage,
} from "@/lib/public-store/checkout/errors";
import { isStoreCheckoutEnabled } from "@/lib/public-store/checkout/feature-flags";
import { parseCreateStoreOrderBody } from "@/lib/public-store/checkout/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_768;

export async function POST(request: Request) {
  if (!isStoreCheckoutEnabled()) {
    return NextResponse.json(
      {
        ok: false,
        code: "CHECKOUT_DISABLED",
        error: storeCheckoutPublicMessage("CHECKOUT_DISABLED"),
      },
      { status: 403 },
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { ok: false, code: "PAYLOAD_REJECTED", error: "Payload excesivo." },
      { status: 413 },
    );
  }

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { ok: false, code: "PAYLOAD_REJECTED", error: "Payload excesivo." },
        { status: 413 },
      );
    }
    raw = JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { ok: false, code: "PAYLOAD_REJECTED", error: "JSON inválido." },
      { status: 400 },
    );
  }

  const parsed = parseCreateStoreOrderBody(raw);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, code: "PAYLOAD_REJECTED", error: parsed.error },
      { status: 400 },
    );
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const clientIp =
    forwarded?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;

  try {
    const result = await createStoreOrder({
      body: parsed.data,
      clientIp,
      userAgent: request.headers.get("user-agent"),
    });

    if (result.accessToken) {
      const jar = await cookies();
      jar.set(STORE_ORDER_ACCESS_COOKIE, result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/tienda",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    return NextResponse.json({
      ok: true,
      publicId: result.publicId,
      status: result.status,
      paymentStatus: result.paymentStatus,
      checkoutUrl: result.checkoutUrl,
      totalAmount: result.totalAmount,
      currency: result.currency,
      holdExpiresAt: result.holdExpiresAt,
      reused: result.reused,
      commercialFingerprint: result.commercialFingerprint,
      orderPath: `/tienda/pedido/${encodeURIComponent(result.publicId)}`,
      /** Para limpiar solo líneas compradas tras PAID canónico. */
      purchasedItems: parsed.data.items.map((i) => ({
        productId: i.productId,
        variantId: i.variantId,
      })),
    });
  } catch (err) {
    if (err instanceof StoreCheckoutError) {
      return NextResponse.json(
        {
          ok: false,
          code: err.code,
          error: storeCheckoutPublicMessage(err.code),
        },
        { status: err.httpStatus },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        code: "INTERNAL",
        error: storeCheckoutPublicMessage("INTERNAL"),
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: false, code: "METHOD_NOT_ALLOWED" }, { status: 405 });
}
