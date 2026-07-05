"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import CheckoutMpPreparingOverlay from "@/components/checkout/CheckoutMpPreparingOverlay";
import PaymentRecoveryActions from "@/components/checkout/PaymentRecoveryActions";
import { useMpPaymentRetry } from "@/lib/checkout/use-mp-payment-retry";
import { readPendingOrderSession } from "@/lib/checkout/pending-order-session";
import { trackFunnelEvent, FUNNEL_EVENTS } from "@/lib/funnel-track-client";

type FailureContext = {
  backUrl: string;
  canRetry: boolean;
  albumTitle: string | null;
};

export default function PendingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const orderType = (searchParams.get("orderType") || "PRINT_ORDER") as "PRINT_ORDER" | "ALBUM_ORDER";
  const paymentId = searchParams.get("payment_id") || searchParams.get("preference_id");
  const orderId = orderIdParam ? Number(orderIdParam) : null;
  const isAlbumOrder = orderType === "ALBUM_ORDER" && orderId != null && Number.isFinite(orderId);

  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [context, setContext] = useState<FailureContext | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");

  const {
    retryPayment,
    retrying,
    mpPreparing,
    mpPreparingStep,
    retryError,
    retryRequiresEmail,
    setRetryRequiresEmail,
  } = useMpPaymentRetry({
    orderId: orderId ?? 0,
    orderType,
    buyerEmail,
  });

  const loadContext = useCallback(async () => {
    if (!isAlbumOrder || !orderId) return;
    try {
      const params = new URLSearchParams({
        orderId: String(orderId),
        orderType: "ALBUM_ORDER",
      });
      const email = buyerEmail.trim();
      if (email) params.set("buyerEmail", email);

      const res = await fetch(`/api/payments/mp/failure-context?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.retryRequiresEmail || data.code === "FORBIDDEN") {
          setRetryRequiresEmail(true);
        }
        return;
      }

      setContext({
        backUrl: data.backUrl ?? "/",
        canRetry: Boolean(data.canRetry),
        albumTitle: data.albumTitle ?? null,
      });
      setRetryRequiresEmail(false);
    } catch {
      /* noop */
    }
  }, [buyerEmail, isAlbumOrder, orderId, setRetryRequiresEmail]);

  useEffect(() => {
    void loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (!context?.backUrl) return;
    const match = context.backUrl.match(/\/a\/(\d+)/);
    if (!match) return;
    const session = readPendingOrderSession(match[1]);
    if (session?.buyerEmail && !buyerEmail.trim()) {
      setBuyerEmail(session.buyerEmail);
    }
  }, [context?.backUrl, buyerEmail]);

  const confirmPayment = useCallback(async () => {
    if (!orderId) return;

    setConfirming(true);
    setConfirmError(null);

    try {
      void trackFunnelEvent(FUNNEL_EVENTS.PAYMENT_PENDING_STATUS_REFRESHED, {
        orderId,
      });

      if (!paymentId) {
        setConfirmError("No encontramos el ID de pago. Podés reintentar el pago.");
        setConfirmed(true);
        return;
      }

      const res = await fetch("/api/payments/mp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          orderId,
          orderType,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setConfirmError(
          typeof data.error === "string"
            ? data.error
            : "No pudimos actualizar el estado. Intentá de nuevo."
        );
        setConfirmed(true);
        return;
      }

      setPaymentStatus(data.paymentStatus ?? null);
      setConfirmed(true);

      if (data.paymentStatus === "approved") {
        const qs = new URLSearchParams({
          orderId: String(orderId),
          orderType,
          payment_id: paymentId,
        });
        router.push(`/pago/success?${qs.toString()}`);
      }
    } catch {
      setConfirmError("No pudimos actualizar el estado. Intentá de nuevo.");
      setConfirmed(true);
    } finally {
      setConfirming(false);
    }
  }, [orderId, orderType, paymentId, router]);

  useEffect(() => {
    if (!orderId || !paymentId) return;
    void confirmPayment();
  }, [orderId, paymentId, confirmPayment]);

  const backHref = context?.backUrl ?? "/";
  const backLabel =
    context?.backUrl && context.backUrl !== "/" ? "Volver al álbum" : "Volver al inicio";
  const canRetry = isAlbumOrder ? (context?.canRetry ?? true) : false;

  return (
    <>
      <CheckoutMpPreparingOverlay open={mpPreparing} step={mpPreparingStep} />
      <main className="w-full max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <Card className="p-6 sm:p-8 w-full">
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111827]">Pago pendiente</h1>
          <p className="text-sm text-[#4b5563] mt-2">
            Pedido <b>#{orderId ?? "—"}</b>
            {context?.albumTitle ? (
              <span className="block mt-1 text-[#6b7280]">{context.albumTitle}</span>
            ) : null}
          </p>

          <div className="mt-6 space-y-2 rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4">
            <p className="text-sm font-medium text-[#374151]">Tu pedido está guardado</p>
            <p className="text-sm text-[#4b5563] leading-relaxed">
              Mercado Pago todavía no confirmó el pago. Podés actualizar el estado o reintentar el
              pago.
            </p>
          </div>

          {confirming ? (
            <p className="mt-4 text-sm text-[#6b7280]">Verificando estado del pago…</p>
          ) : null}

          {confirmed && paymentStatus === "approved" ? (
            <p className="mt-4 text-sm text-emerald-800">Pago confirmado. Redirigiendo…</p>
          ) : null}

          {confirmed && paymentStatus && paymentStatus !== "approved" ? (
            <p className="mt-4 text-sm text-[#6b7280]">
              El pago sigue pendiente. Te avisaremos cuando se confirme.
            </p>
          ) : null}

          {!confirming && !confirmed && !paymentId ? (
            <p className="mt-4 text-sm text-[#6b7280]">
              El pago quedó pendiente. Podés reintentarlo cuando quieras.
            </p>
          ) : null}

          {confirmError ? (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {confirmError}
            </p>
          ) : null}

          {orderId && Number.isFinite(orderId) && isAlbumOrder ? (
            <div className="mt-6 pt-2 border-t border-[#e5e7eb]">
              <PaymentRecoveryActions
                orderId={orderId}
                orderType={orderType}
                backHref={backHref}
                backLabel={backLabel}
                canRetry={canRetry}
                buyerEmail={buyerEmail}
                onBuyerEmailChange={setBuyerEmail}
                retryRequiresEmail={retryRequiresEmail}
                onRetry={() => {
                  void retryPayment();
                }}
                onRefresh={() => confirmPayment()}
                retrying={retrying}
                refreshing={confirming}
                retryError={retryError}
                showRefresh={Boolean(paymentId)}
              />
            </div>
          ) : (
            <div className="mt-6">
              <Link href="/" className="w-full block">
                <Button variant="primary" size="md" className="w-full">
                  Volver al inicio
                </Button>
              </Link>
            </div>
          )}
        </Card>
      </main>
    </>
  );
}
