export type RetryAlbumPaymentResult =
  | { ok: true; initPoint: string; reused: boolean }
  | {
      ok: false;
      error: string;
      code?: string;
      retryRequiresEmail?: boolean;
      httpStatus?: number;
    };

export async function retryAlbumOrderPaymentClient(params: {
  orderId: number;
  orderType?: string;
  buyerEmail?: string;
  forceRegenerate?: boolean;
}): Promise<RetryAlbumPaymentResult> {
  const body: Record<string, unknown> = {
    orderId: params.orderId,
    orderType: params.orderType ?? "ALBUM_ORDER",
  };
  if (params.buyerEmail?.trim()) {
    body.buyerEmail = params.buyerEmail.trim();
  }
  if (params.forceRegenerate) {
    body.forceRegenerate = true;
  }

  const res = await fetch("/api/payments/mp/retry-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      error:
        typeof data.error === "string"
          ? data.error
          : "No pudimos iniciar el pago. Intentá de nuevo.",
      code: typeof data.code === "string" ? data.code : undefined,
      retryRequiresEmail: data.retryRequiresEmail === true,
      httpStatus: res.status,
    };
  }

  if (typeof data.initPoint !== "string" || !data.initPoint.trim()) {
    return { ok: false, error: "No recibimos el enlace de pago. Intentá de nuevo." };
  }

  return {
    ok: true,
    initPoint: data.initPoint,
    reused: data.reused === true,
  };
}
