"use client";

import { useCallback, useRef, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import {
  assertMercadoPagoDeviceSessionId,
  mapBrickFormDataToCardPaymentSubmission,
  mapMercadoPagoStatusDetailToUserMessage,
  type CardBrickUiState,
  type MercadoPagoCardPaymentBrickFormData,
} from "@repo/payments/frontend";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { submitRegistrationCardPaymentAction } from "@/lib/checkout/actions/card-payment";
import { CARD_BRICK_PUBLIC_COPY } from "@/lib/public-ux/checkout-public-copy";

export { CARD_BRICK_PUBLIC_COPY };

type Props = {
  publicKey: string;
  /** Display-only amount for Brick UI — server reconstructs charge amount. */
  amountMinor: number;
  currency: string;
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  /** Optional prefill — server always charges with registration email. */
  payerEmail?: string;
  locale?: string;
  testEnvironment?: boolean;
};

let mpInitializedForKey: string | null = null;

function ensureMercadoPagoInit(publicKey: string) {
  if (mpInitializedForKey === publicKey) return;
  initMercadoPago(publicKey, { locale: "es-AR" });
  mpInitializedForKey = publicKey;
}

/**
 * Card Payment Brick shell — wrappers propios evitan overflow horizontal en smartphones.
 * No modifica el SDK de Mercado Pago.
 */
export function CardPaymentBrickCheckout(props: Props) {
  ensureMercadoPagoInit(props.publicKey);
  const [uiState, setUiState] = useState<CardBrickUiState>("INITIAL");
  const [message, setMessage] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const amountMajor = props.amountMinor / 100;

  const onReady = useCallback(() => {
    setUiState("READY");
  }, []);

  const onError = useCallback((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "card_brick_error",
        // Never log Brick form payloads / tokens
        name: error instanceof Error ? error.name : "BrickError",
        message:
          error instanceof Error ? error.message.slice(0, 120) : "brick_error",
      }),
    );
    setUiState("ERROR");
    setMessage(CARD_BRICK_PUBLIC_COPY.loadError);
  }, []);

  const onSubmit = useCallback(
    async (formData: MercadoPagoCardPaymentBrickFormData) => {
      if (submittingRef.current) {
        return;
      }
      submittingRef.current = true;
      setUiState("SUBMITTING");
      setMessage(null);

      try {
        const deviceSessionId = assertMercadoPagoDeviceSessionId();
        const submission = mapBrickFormDataToCardPaymentSubmission(
          formData,
          deviceSessionId,
        );

        setUiState("PROCESSING");
        const result = await submitRegistrationCardPaymentAction({
          registrationId: props.registrationId,
          editionSlug: props.editionSlug,
          accessToken: props.accessToken,
          cardPayment: submission,
          // Displayed amount — server ignores for charging (tamper check only).
          clientDisplayedAmountMinor: props.amountMinor,
        });

        if (!result.ok || !result.data) {
          setUiState("ERROR");
          setMessage(result.message ?? "No pudimos procesar el pago.");
          submittingRef.current = false;
          return;
        }

        setUiState(result.data.uiState);
        setMessage(result.data.userMessage);

        if (
          result.data.uiState === "APPROVED" ||
          result.data.uiState === "PROCESSING" ||
          result.data.uiState === "REJECTED"
        ) {
          window.location.assign(result.data.redirectPath);
          return;
        }
        submittingRef.current = false;
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "CARD_PAYMENT_FAILED";
        setUiState("ERROR");
        setMessage(
          detail.startsWith("DEVICE_SESSION")
            ? CARD_BRICK_PUBLIC_COPY.deviceSession
            : mapMercadoPagoStatusDetailToUserMessage(null),
        );
        submittingRef.current = false;
        throw error;
      }
    },
    [
      props.accessToken,
      props.amountMinor,
      props.editionSlug,
      props.registrationId,
    ],
  );

  const busy =
    uiState === "SUBMITTING" ||
    uiState === "PROCESSING" ||
    submittingRef.current;

  return (
    <div className="min-w-0 max-w-full space-y-4" aria-busy={busy}>
      {props.testEnvironment ? (
        <p
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-ck-text-secondary"
          role="status"
        >
          {CARD_BRICK_PUBLIC_COPY.testBanner}
        </p>
      ) : null}

      <p className="text-sm text-ck-text-secondary">
        {CARD_BRICK_PUBLIC_COPY.amountPrefix}{" "}
        <strong className="text-ck-text">
          {formatPublicPrice(props.amountMinor, props.currency)}
        </strong>
      </p>

      {uiState === "INITIAL" ? (
        <p className="text-sm text-ck-text-secondary" role="status" aria-live="polite">
          {CARD_BRICK_PUBLIC_COPY.loading} {CARD_BRICK_PUBLIC_COPY.loadingHint}
        </p>
      ) : null}

      {/* Official MP device id sink (SDK also sets window.MP_DEVICE_SESSION_ID). */}
      <input type="hidden" id="deviceId" name="deviceId" readOnly value="" />

      <p className="text-xs text-ck-text-muted sm:hidden">{CARD_BRICK_PUBLIC_COPY.scrollHint}</p>

      {/*
        Contenedor propio: min-w-0 + overflow-x controlado para 320–430px.
        No se tocan clases internas del SDK de Mercado Pago.
      */}
      <div
        className={
          busy
            ? "pointer-events-none min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[var(--ck-radius-card)] opacity-60 [-webkit-overflow-scrolling:touch]"
            : "min-w-0 max-w-full overflow-x-auto overscroll-x-contain rounded-[var(--ck-radius-card)] [-webkit-overflow-scrolling:touch]"
        }
        aria-disabled={busy}
        data-testid="card-brick-viewport"
      >
        <div className="min-w-0 w-full max-w-full">
          <CardPayment
            locale={(props.locale as "es-AR") ?? "es-AR"}
            initialization={{
              amount: amountMajor,
              ...(props.payerEmail
                ? { payer: { email: props.payerEmail } }
                : {}),
            }}
            onReady={onReady}
            onError={onError}
            onSubmit={async (formData) => {
              await onSubmit(formData as MercadoPagoCardPaymentBrickFormData);
            }}
          />
        </div>
      </div>

      {message ? (
        <p
          className={
            uiState === "APPROVED"
              ? "text-sm text-emerald-400"
              : uiState === "REJECTED" || uiState === "ERROR"
                ? "text-sm text-red-400"
                : "text-sm text-ck-text-secondary"
          }
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      ) : null}

      {uiState === "PROCESSING" || uiState === "SUBMITTING" ? (
        <p className="text-sm text-ck-text-secondary" role="status" aria-live="polite">
          {CARD_BRICK_PUBLIC_COPY.processing}
        </p>
      ) : null}
    </div>
  );
}
