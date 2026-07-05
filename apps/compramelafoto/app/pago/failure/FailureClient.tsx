"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { getCheckoutEmailValidationError } from "@/lib/email-validation";

type FailureContext = {
  orderId: number;
  orderType: "ALBUM_ORDER";
  total: number;
  albumTitle: string | null;
  albumSlug: string | null;
  orderStatus: string;
  canRetry: boolean;
  backUrl: string;
  isPreventaPack: boolean;
};

function formatTotalArs(total: number): string {
  return total.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default function FailureClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderIdParam = searchParams.get("orderId");
  const orderTypeParam = searchParams.get("orderType") || "PRINT_ORDER";
  const paymentId =
    searchParams.get("payment_id") || searchParams.get("preference_id");

  const isAlbumScope = orderTypeParam === "ALBUM_ORDER";
  const orderId = orderIdParam ? Number(orderIdParam) : null;

  const [context, setContext] = useState<FailureContext | null>(null);
  const [contextLoading, setContextLoading] = useState(isAlbumScope);
  const [contextError, setContextError] = useState<string | null>(null);
  const [retryRequiresEmail, setRetryRequiresEmail] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadContext = useCallback(
    async (emailForVerify?: string) => {
      if (!isAlbumScope || !orderId || !Number.isFinite(orderId)) {
        setContextLoading(false);
        return;
      }

      setContextLoading(true);
      setContextError(null);

      try {
        const params = new URLSearchParams({
          orderId: String(orderId),
          orderType: "ALBUM_ORDER",
        });
        const email = (emailForVerify ?? buyerEmail).trim();
        if (email) {
          params.set("buyerEmail", email);
        }

        const res = await fetch(`/api/payments/mp/failure-context?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          if (data.retryRequiresEmail || data.code === "FORBIDDEN") {
            setRetryRequiresEmail(true);
            setContextError(null);
          } else {
            setContextError(
              typeof data.error === "string"
                ? data.error
                : "No pudimos cargar los datos del pedido."
            );
          }
          setContext(null);
          return;
        }

        setContext(data as FailureContext);
        setRetryRequiresEmail(false);
        setContextError(null);
      } catch {
        setContextError("No pudimos cargar los datos del pedido.");
      } finally {
        setContextLoading(false);
      }
    },
    [buyerEmail, isAlbumScope, orderId]
  );

  useEffect(() => {
    if (isAlbumScope) {
      void loadContext();
    }
  }, [isAlbumScope, loadContext]);

  useEffect(() => {
    if (!isAlbumScope || !orderId || !paymentId) {
      return;
    }

    async function confirmPayment() {
      setConfirming(true);
      try {
        await fetch("/api/payments/mp/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentId,
            orderId,
            orderType: "ALBUM_ORDER",
          }),
        });
        await loadContext();
      } catch (err) {
        console.error("Error confirmando pago:", err);
      } finally {
        setConfirming(false);
      }
    }

    void confirmPayment();
  }, [isAlbumScope, orderId, paymentId, loadContext]);

  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    const err = getCheckoutEmailValidationError(buyerEmail);
    if (err) {
      setEmailError(err);
      return;
    }
    setEmailError(null);
    await loadContext(buyerEmail);
  }

  async function handleRetry(forceRegenerate = false) {
    if (!orderId || !Number.isFinite(orderId)) return;

    if (retryRequiresEmail || (!context && buyerEmail.trim())) {
      const err = getCheckoutEmailValidationError(buyerEmail);
      if (err) {
        setEmailError(err);
        return;
      }
    }

    setRetrying(true);
    setRetryError(null);
    setEmailError(null);

    try {
      const body: Record<string, unknown> = {
        orderId,
        orderType: "ALBUM_ORDER",
        forceRegenerate,
      };
      if (buyerEmail.trim()) {
        body.buyerEmail = buyerEmail.trim();
      }

      const res = await fetch("/api/payments/mp/retry-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === "ALREADY_PAID") {
          router.push(
            `/pago/success?orderId=${orderId}&orderType=ALBUM_ORDER`
          );
          return;
        }
        if (data.retryRequiresEmail) {
          setRetryRequiresEmail(true);
        }
        setRetryError(
          typeof data.error === "string"
            ? data.error
            : "No pudimos iniciar el pago. Intentá de nuevo."
        );
        return;
      }

      if (typeof data.initPoint === "string" && data.initPoint) {
        window.location.href = data.initPoint;
        return;
      }

      setRetryError("No recibimos el enlace de pago. Intentá de nuevo.");
    } catch {
      setRetryError("No pudimos iniciar el pago. Intentá de nuevo.");
    } finally {
      setRetrying(false);
    }
  }

  const displayOrderId = context?.orderId ?? orderId;
  const backUrl = context?.backUrl ?? "/";
  const canRetry = context?.canRetry ?? false;
  const alreadyPaid = context?.orderStatus === "PAID";

  if (!isAlbumScope) {
    return (
      <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
          <p className="text-3xl mb-3" aria-hidden>
            ⚠️
          </p>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#111827]">
            No pudimos procesar tu pago
          </h1>
          <p className="text-sm sm:text-base text-[#4b5563] mt-3">
            Pedido: <strong>#{orderIdParam ?? "—"}</strong>
          </p>
          <p className="text-sm text-[#6b7280] mt-2">
            Para este tipo de pedido, contactá soporte o volvé al inicio.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button variant="primary" className="w-full sm:w-auto">
                Volver al inicio
              </Button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full max-w-lg mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 shadow-sm">
        <p className="text-3xl mb-3" aria-hidden>
          ⚠️
        </p>
        <h1 className="text-xl sm:text-2xl font-semibold text-[#111827]">
          No pudimos procesar tu pago
        </h1>
        <p className="text-sm sm:text-base text-[#4b5563] mt-3">
          Tu pedido sigue guardado.
        </p>

        {confirming && (
          <p className="text-sm text-[#6b7280] mt-4">Actualizando estado del pago…</p>
        )}

        {contextLoading && (
          <p className="text-sm text-[#6b7280] mt-4">Cargando datos del pedido…</p>
        )}

        {retryRequiresEmail && !context && !contextLoading && (
          <form onSubmit={handleVerifyEmail} className="mt-6 space-y-3">
            <p className="text-sm text-[#4b5563]">
              Ingresá el email que usaste al comprar para ver tu pedido y reintentar el
              pago.
            </p>
            <Input
              type="email"
              autoComplete="email"
              placeholder="tu@email.com"
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              disabled={contextLoading}
            />
            {emailError && (
              <p className="text-sm text-red-600" role="alert">
                {emailError}
              </p>
            )}
            <Button type="submit" variant="secondary" disabled={contextLoading}>
              Ver mi pedido
            </Button>
          </form>
        )}

        {contextError && !retryRequiresEmail && !contextLoading && (
          <p className="text-sm text-[#6b7280] mt-4">{contextError}</p>
        )}

        {context && (
          <>
            <div className="mt-6 rounded-xl bg-[#f9fafb] border border-[#f3f4f6] px-4 py-3 space-y-1">
              <p className="text-sm text-[#374151]">
                Pedido <strong>#{displayOrderId}</strong>
              </p>
              <p className="text-sm text-[#374151]">
                Total: <strong>{formatTotalArs(context.total)}</strong>
              </p>
              {context.albumTitle && (
                <p className="text-sm text-[#6b7280]">{context.albumTitle}</p>
              )}
            </div>

            {alreadyPaid && (
              <p className="text-sm text-emerald-700 mt-4 font-medium">
                Este pedido ya fue pagado.
              </p>
            )}

            {!canRetry && !alreadyPaid && (
              <p className="text-sm text-[#6b7280] mt-4">
                Este pedido no admite reintento de pago. Podés volver a la galería.
              </p>
            )}

            {retryError && (
              <p className="text-sm text-red-600 mt-4" role="alert">
                {retryError}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-3">
              {canRetry && (
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={retrying || contextLoading}
                  onClick={() => void handleRetry()}
                >
                  {retrying ? "Preparando pago…" : "Reintentar pago"}
                </Button>
              )}

              {alreadyPaid ? (
                <Link href={`/pago/success?orderId=${displayOrderId}&orderType=ALBUM_ORDER`}>
                  <Button variant="primary" className="w-full">
                    Ver confirmación de pago
                  </Button>
                </Link>
              ) : (
                <Link href={backUrl}>
                  <Button variant={canRetry ? "secondary" : "primary"} className="w-full">
                    Volver a mis fotos
                  </Button>
                </Link>
              )}
            </div>
          </>
        )}

        {!context && !contextLoading && !retryRequiresEmail && orderId && (
          <div className="mt-6">
            <p className="text-sm text-[#4b5563] mb-3">
              Pedido <strong>#{orderId}</strong>
            </p>
            <Link href="/">
              <Button variant="secondary">Volver al inicio</Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
