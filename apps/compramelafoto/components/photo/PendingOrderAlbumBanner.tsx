"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import { useMpPaymentRetry } from "@/lib/checkout/use-mp-payment-retry";
import {
  clearPendingOrderSession,
  readPendingOrderSession,
} from "@/lib/checkout/pending-order-session";
import { trackFunnelEvent, FUNNEL_EVENTS } from "@/lib/funnel-track-client";

type Props = {
  albumId: number;
};

export default function PendingOrderAlbumBanner({ albumId }: Props) {
  const albumIdStr = String(albumId);
  const [visible, setVisible] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [buyerEmail, setBuyerEmail] = useState<string | undefined>(undefined);
  const [checking, setChecking] = useState(true);

  const {
    retryPayment,
    retrying,
    mpPreparing,
    mpPreparingStep,
    retryError,
  } = useMpPaymentRetry({
    orderId: orderId ?? 0,
    albumId,
    buyerEmail,
  });

  const validateSession = useCallback(async () => {
    setChecking(true);
    const session = readPendingOrderSession(albumIdStr);
    if (!session) {
      setVisible(false);
      setOrderId(null);
      setChecking(false);
      return;
    }

    try {
      const res = await fetch(
        `/api/a/${albumId}/orders/${session.orderId}/checkout-status`,
        { credentials: "include" }
      );
      if (!res.ok) {
        clearPendingOrderSession(albumIdStr);
        setVisible(false);
        setOrderId(null);
        return;
      }
      const data = await res.json();
      if (data.status === "PAID" || !data.canRetry) {
        clearPendingOrderSession(albumIdStr);
        setVisible(false);
        setOrderId(null);
        return;
      }
      setOrderId(session.orderId);
      setBuyerEmail(session.buyerEmail);
      setVisible(true);
      void trackFunnelEvent(FUNNEL_EVENTS.PENDING_ORDER_BANNER_SHOWN, {
        albumId,
        orderId: session.orderId,
      });
    } catch {
      setVisible(false);
    } finally {
      setChecking(false);
    }
  }, [albumId, albumIdStr]);

  useEffect(() => {
    void validateSession();
  }, [validateSession]);

  function handleDismiss() {
    clearPendingOrderSession(albumIdStr);
    setVisible(false);
    void trackFunnelEvent(FUNNEL_EVENTS.PENDING_ORDER_BANNER_DISMISSED, {
      albumId,
      orderId: orderId ?? undefined,
    });
  }

  async function handleContinue() {
    if (!orderId) return;
    void trackFunnelEvent(FUNNEL_EVENTS.PENDING_ORDER_BANNER_CONTINUE_CLICKED, {
      albumId,
      orderId,
    });
    await retryPayment();
  }

  if (checking || !visible || !orderId) {
    return mpPreparing ? (
      <CheckoutMpPreparingOverlay open={mpPreparing} step={mpPreparingStep} />
    ) : null;
  }

  return (
    <>
      <CheckoutMpPreparingOverlay open={mpPreparing} step={mpPreparingStep} />
      <div className="mb-6 w-full min-w-0 max-w-none self-stretch">
        <Card className="w-full rounded-xl border border-sky-200 bg-sky-50/90 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm sm:text-base font-semibold text-sky-950">
                Tenés un pago pendiente
              </p>
              <p className="text-sm text-sky-900/90 leading-relaxed">
                Tu pedido quedó guardado. Podés continuar el pago sin volver a elegir las fotos.
              </p>
              <p className="text-xs text-sky-800/80">Pedido #{orderId}</p>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[14rem] shrink-0">
              <Button
                type="button"
                variant="primary"
                size="md"
                className="w-full"
                disabled={retrying || mpPreparing}
                onClick={() => void handleContinue()}
              >
                {retrying || mpPreparing ? "Preparando pago…" : "Continuar pago"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="md"
                className="w-full"
                disabled={retrying || mpPreparing}
                onClick={handleDismiss}
              >
                Descartar aviso
              </Button>
            </div>
          </div>
          {retryError ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {retryError}
            </p>
          ) : null}
        </Card>
      </div>
    </>
  );
}
