"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { retryAlbumOrderPaymentClient } from "@/lib/checkout/retry-album-payment-client";
import { redirectToMercadoPago } from "@/lib/checkout/mp-redirect";
import { trackFunnelEvent, FUNNEL_EVENTS } from "@/lib/funnel-track-client";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";

type UseMpPaymentRetryOptions = {
  orderId: number;
  albumId?: string | number;
  orderType?: string;
  buyerEmail?: string;
  onFunnelRetry?: boolean;
};

export function useMpPaymentRetry({
  orderId,
  albumId,
  orderType = "ALBUM_ORDER",
  buyerEmail,
}: UseMpPaymentRetryOptions) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [mpPreparing, setMpPreparing] = useState(false);
  const [mpPreparingStep, setMpPreparingStep] = useState<1 | 2>(1);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [retryRequiresEmail, setRetryRequiresEmail] = useState(false);

  const retryPayment = useCallback(
    async (emailOverride?: string) => {
      const email = (emailOverride ?? buyerEmail ?? "").trim();
      if (retryRequiresEmail || emailOverride !== undefined) {
        const err = getCheckoutEmailValidationError(email);
        if (err) {
          setRetryError(err);
          return { ok: false as const };
        }
      }

      setRetrying(true);
      setRetryError(null);
      const startedAt = Date.now();

      try {
        void trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_RETRY_CLICKED, {
          orderId,
          albumId,
        });

        const result = await retryAlbumOrderPaymentClient({
          orderId,
          orderType,
          buyerEmail: email || undefined,
        });

        if (!result.ok) {
          if (result.code === "ALREADY_PAID") {
            router.push(`/pago/success?orderId=${orderId}&orderType=${orderType}`);
            return { ok: false as const };
          }
          if (result.retryRequiresEmail) {
            setRetryRequiresEmail(true);
          }
          setRetryError(result.error);
          return { ok: false as const };
        }

        setMpPreparing(true);
        setMpPreparingStep(1);
        await new Promise((r) => setTimeout(r, 280));
        setMpPreparingStep(2);
        await redirectToMercadoPago(result.initPoint, { startedAt });
        return { ok: true as const };
      } catch {
        setRetryError("No pudimos iniciar el pago. Intentá de nuevo.");
        setMpPreparing(false);
        return { ok: false as const };
      } finally {
        setRetrying(false);
      }
    },
    [albumId, buyerEmail, orderId, orderType, retryRequiresEmail, router]
  );

  return {
    retryPayment,
    retrying,
    mpPreparing,
    mpPreparingStep,
    retryError,
    setRetryError,
    retryRequiresEmail,
    setRetryRequiresEmail,
  };
}
