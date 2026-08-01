"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { startRegistrationCheckoutAction } from "@/lib/checkout/actions/checkout";
import { formatPublicPrice } from "@/lib/public-registration/ui/format";
import { CardPaymentBrickCheckout } from "@/components/payments/CardPaymentBrickCheckout";
import { CHECKOUT_PUBLIC_COPY } from "@/lib/public-ux/checkout-public-copy";

export { CHECKOUT_PUBLIC_COPY };

type Props = {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  amountMinor: number;
  currency: string;
  expiresLabel: string;
  eligible: boolean;
  /** Entorno de prueba (sin cobros reales). */
  testEnvironment?: boolean;
  /** When true, render Card Payment Brick instead of Checkout Pro redirect. */
  cardBrickEnabled?: boolean;
  /** Browser-safe MP public key (never access token). */
  mercadoPagoPublicKey?: string | null;
  payerEmail?: string;
  /** Si el redirect server falló, dispara el checkout al montar. */
  autoStart?: boolean;
};

function SubmitButton({
  eligible,
  testEnvironment,
  isFree,
}: {
  eligible: boolean;
  testEnvironment?: boolean;
  isFree: boolean;
}) {
  const { pending } = useFormStatus();
  const label = pending
    ? CHECKOUT_PUBLIC_COPY.preparing
    : isFree
      ? CHECKOUT_PUBLIC_COPY.freeConfirm
      : testEnvironment
        ? CHECKOUT_PUBLIC_COPY.payTest
        : CHECKOUT_PUBLIC_COPY.payLive;
  return (
    <button
      type="submit"
      disabled={!eligible || pending}
      className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-ck-yellow px-6 text-sm font-semibold text-ck-bg disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      aria-busy={pending}
      aria-label={label}
    >
      {label}
    </button>
  );
}

function CheckoutProRedirectForm(props: {
  registrationId: string;
  editionSlug: string;
  accessToken: string;
  amountMinor: number;
  currency: string;
  expiresLabel: string;
  eligible: boolean;
  testEnvironment?: boolean;
  autoStart?: boolean;
  isFree: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const autoStartedRef = useRef(false);

  useEffect(() => {
    if (!props.autoStart || !props.eligible || autoStartedRef.current) return;
    autoStartedRef.current = true;
    formRef.current?.requestSubmit();
  }, [props.autoStart, props.eligible]);

  return (
    <form ref={formRef} action={startRegistrationCheckoutAction} className="min-w-0 space-y-3">
      <input type="hidden" name="registrationId" value={props.registrationId} />
      <input type="hidden" name="editionSlug" value={props.editionSlug} />
      <input type="hidden" name="accessToken" value={props.accessToken} />
      {props.testEnvironment ? (
        <p
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-ck-text-secondary"
          role="status"
        >
          {CHECKOUT_PUBLIC_COPY.testBanner}
        </p>
      ) : null}
      <p className="text-sm leading-relaxed text-ck-text-secondary">
        {CHECKOUT_PUBLIC_COPY.redirectIntro(
          formatPublicPrice(props.amountMinor, props.currency),
          props.expiresLabel,
        )}
      </p>
      {!props.isFree ? (
        <p className="text-sm text-ck-text-muted">{CHECKOUT_PUBLIC_COPY.redirectHint}</p>
      ) : null}
      {props.autoStart ? (
        <p className="text-sm text-ck-yellow" role="status" aria-live="polite">
          {CHECKOUT_PUBLIC_COPY.opening}
        </p>
      ) : null}
      <SubmitButton
        eligible={props.eligible}
        testEnvironment={props.testEnvironment}
        isFree={props.isFree}
      />
    </form>
  );
}

/** Client Component: Checkout Pro redirect OR Card Payment Brick. */
export function CheckoutPayButton(props: Props) {
  if (!props.eligible) return null;

  const isFree = props.amountMinor === 0;

  if (props.cardBrickEnabled && props.mercadoPagoPublicKey) {
    return (
      <div className="min-w-0 space-y-3">
        <p className="text-sm leading-relaxed text-ck-text-secondary">
          {CHECKOUT_PUBLIC_COPY.brickIntro(props.expiresLabel)}
        </p>
        <p className="text-sm text-ck-text-secondary">{CHECKOUT_PUBLIC_COPY.afterPay}</p>
        <CardPaymentBrickCheckout
          publicKey={props.mercadoPagoPublicKey}
          amountMinor={props.amountMinor}
          currency={props.currency}
          registrationId={props.registrationId}
          editionSlug={props.editionSlug}
          accessToken={props.accessToken}
          {...(props.payerEmail ? { payerEmail: props.payerEmail } : {})}
          testEnvironment={props.testEnvironment}
        />
      </div>
    );
  }

  return (
    <CheckoutProRedirectForm
      registrationId={props.registrationId}
      editionSlug={props.editionSlug}
      accessToken={props.accessToken}
      amountMinor={props.amountMinor}
      currency={props.currency}
      expiresLabel={props.expiresLabel}
      eligible={props.eligible}
      testEnvironment={props.testEnvironment}
      autoStart={props.autoStart}
      isFree={isFree}
    />
  );
}
