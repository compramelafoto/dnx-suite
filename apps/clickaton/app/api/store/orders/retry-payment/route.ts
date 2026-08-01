import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@repo/db";
import {
  STORE_ORDER_ACCESS_COOKIE,
  hashStoreOrderAccessToken,
} from "@/lib/public-store/checkout/access-token";
import { createStorePaymentPreference } from "@/lib/public-store/checkout/create-store-payment";
import {
  StoreCheckoutError,
  storeCheckoutPublicMessage,
} from "@/lib/public-store/checkout/errors";
import { isStoreCheckoutEnabled } from "@/lib/public-store/checkout/feature-flags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

  let body: { publicId?: string };
  try {
    body = (await request.json()) as { publicId?: string };
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON inválido." },
      { status: 400 },
    );
  }

  const publicId = body.publicId?.trim();
  if (!publicId?.startsWith("sto_")) {
    return NextResponse.json(
      { ok: false, error: storeCheckoutPublicMessage("ORDER_NOT_FOUND") },
      { status: 404 },
    );
  }

  const jar = await cookies();
  const token = jar.get(STORE_ORDER_ACCESS_COOKIE)?.value;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: storeCheckoutPublicMessage("ACCESS_DENIED") },
      { status: 403 },
    );
  }

  const order = await prisma.clickatonStoreOrder.findUnique({
    where: { publicId },
  });
  if (!order || order.accessTokenHash !== hashStoreOrderAccessToken(token)) {
    return NextResponse.json(
      { ok: false, error: storeCheckoutPublicMessage("ACCESS_DENIED") },
      { status: 403 },
    );
  }

  try {
    const pay = await createStorePaymentPreference({
      orderId: order.id,
      publicId: order.publicId,
      reusedAccessToken: token,
    });
    return NextResponse.json({
      ok: true,
      checkoutUrl: pay.checkoutUrl,
      reused: pay.reused,
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
      { ok: false, error: storeCheckoutPublicMessage("PAYMENT_UNAVAILABLE") },
      { status: 503 },
    );
  }
}
