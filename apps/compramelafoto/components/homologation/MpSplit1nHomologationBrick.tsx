"use client";

import { useCallback, useRef, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import {
  assertMercadoPagoDeviceSessionId,
  mapBrickFormDataToCardPaymentSubmission,
  readMercadoPagoDeviceSessionId,
  type CardBrickUiState,
  type MercadoPagoCardPaymentBrickFormData,
} from "@repo/payments/frontend";
import { submitClfMpSplit1nHomologationPaymentAction } from "@/lib/homologation/mp-split-1n/actions";
import type { HomologationScenarioId } from "@/lib/homologation/mp-split-1n/scenarios";

type Props = {
  publicKey: string;
  scenarioId: HomologationScenarioId;
  /** Display-only amount (server reconstructs). */
  amountMinor: number;
  currency: string;
  payerEmail?: string;
};

let mpInitializedForKey: string | null = null;

function ensureMercadoPagoInit(publicKey: string) {
  if (mpInitializedForKey === publicKey) return;
  initMercadoPago(publicKey, { locale: "es-AR" });
  mpInitializedForKey = publicKey;
}

/**
 * Homologation-only Brick shell. Not used by CLF product checkout.
 */
export function MpSplit1nHomologationBrick(props: Props) {
  ensureMercadoPagoInit(props.publicKey);
  const [uiState, setUiState] = useState<CardBrickUiState>("INITIAL");
  const [message, setMessage] = useState<string | null>(null);
  const [resultMeta, setResultMeta] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const amountMajor = props.amountMinor / 100;

  const onReady = useCallback(() => {
    setUiState("READY");
    setMessage(null);
    // Mirror official device session into #deviceId sink when present.
    try {
      const device = readMercadoPagoDeviceSessionId();
      const el = document.getElementById("deviceId") as HTMLInputElement | null;
      if (device && el && !el.value) el.value = device;
      console.info(
        JSON.stringify({
          event: "clf_homologation_brick_ready",
          DEVICE_SESSION_PRESENT: Boolean(device),
          deviceSessionIdLength: device?.length ?? 0,
        }),
      );
    } catch {
      // ignore
    }
  }, []);
  const onError = useCallback((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "clf_homologation_card_brick_error",
        name: error instanceof Error ? error.name : "BrickError",
        message:
          error instanceof Error ? error.message.slice(0, 160) : "brick_error",
      }),
    );
    setUiState("ERROR");
    setMessage(
      "No pudimos cargar el Card Payment Brick (revisá CSP / consola del navegador).",
    );
  }, []);

  const onSubmit = useCallback(
    async (formData: MercadoPagoCardPaymentBrickFormData) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setUiState("SUBMITTING");
      setMessage(null);
      setResultMeta(null);
      try {
        const deviceSessionId = assertMercadoPagoDeviceSessionId();
        const submission = mapBrickFormDataToCardPaymentSubmission(
          formData,
          deviceSessionId,
        );
        setUiState("PROCESSING");
        const result = await submitClfMpSplit1nHomologationPaymentAction({
          scenarioId: props.scenarioId,
          cardPayment: submission,
          clientDisplayedAmountMinor: props.amountMinor,
          // Tamper probes — server must ignore
          clientTotalMinor: 999_999_999,
          clientReceiverIds: ["should-be-ignored"],
        });
        if (!result.ok) {
          setUiState("ERROR");
          setMessage(result.message);
          submittingRef.current = false;
          return;
        }
        setUiState(result.uiState);
        setMessage(result.userMessage);
        setResultMeta(
          [
            `source=${result.source}`,
            `scenario=${result.scenarioId}`,
            `partners=${result.partnerCount}`,
            `order=${result.providerOrderIdPrefix}`,
            `status=${result.status}`,
            `DEVICE_SESSION_PRESENT=${result.DEVICE_SESSION_PRESENT}`,
            `deviceLen=${result.deviceSessionIdLength}`,
            `splitSumValid=${result.splitSumValid}`,
          ].join(" · "),
        );
        submittingRef.current = false;
      } catch (e) {
        const detail = e instanceof Error ? e.message : "FAILED";
        setUiState("ERROR");
        setMessage(
          detail.startsWith("DEVICE_SESSION")
            ? "Esperá a que el Brick inicialice la sesión de seguridad."
            : detail.slice(0, 160),
        );
        submittingRef.current = false;
      }
    },
    [props.amountMinor, props.scenarioId],
  );

  const busy = uiState === "SUBMITTING" || uiState === "PROCESSING";

  return (
    <div className="w-full min-w-0 space-y-4">
      <p className="w-full rounded border border-amber-600/40 bg-amber-50 px-3 py-2 text-xs text-amber-950 whitespace-normal">
        SANDBOX · Homologation only · Production BLOCKED · No crea ventas CLF
      </p>
      <p className="w-full text-sm text-neutral-700 whitespace-normal">
        Importe (solo lectura UI):{" "}
        <strong>
          ${(props.amountMinor / 100).toFixed(2)} {props.currency}
        </strong>
      </p>
      <input type="hidden" id="deviceId" name="deviceId" readOnly value="" />
      <div
        className={`w-full min-w-0 ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <CardPayment
          locale="es-AR"
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
      {message ? (
        <p
          className={
            uiState === "APPROVED"
              ? "text-sm text-emerald-700"
              : uiState === "REJECTED" || uiState === "ERROR"
                ? "text-sm text-red-700"
                : "text-sm text-neutral-700"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
      {resultMeta ? (
        <p className="break-all font-mono text-xs text-neutral-600" role="status">
          {resultMeta}
        </p>
      ) : null}
    </div>
  );
}
