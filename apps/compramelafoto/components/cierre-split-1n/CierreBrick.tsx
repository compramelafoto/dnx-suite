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
import { crearOrdenCierreAction } from "@/lib/cierre-split-1n/actions";

export type CierreResultado = {
  uiState: CardBrickUiState;
  message: string;
  /** Entero. Es el dato que pide Mercado Pago. */
  providerOrderId: string | null;
  status: string | null;
  statusDetail: string | null;
  liveMode: boolean | null;
  evidenciaPath: string | null;
};

type Props = {
  publicKey: string;
  amountMinor: number;
  payerEmail: string;
  onResult: (resultado: CierreResultado) => void;
};

let mpInicializadaPara: string | null = null;

function asegurarMercadoPago(publicKey: string) {
  if (mpInicializadaPara === publicKey) return;
  initMercadoPago(publicKey, { locale: "es-AR" });
  mpInicializadaPara = publicKey;
}

/**
 * Formulario de tarjeta para la orden de cierre, con credenciales **productivas**.
 *
 * Es un componente aparte del de homologación a propósito: aquel produjo la evidencia que
 * Mercado Pago ya aprobó y no conviene tocarlo. Además los dos devuelven cosas distintas
 * —aquel un prefijo del Order ID, este el entero— porque sirven para cosas distintas.
 *
 * Los datos de la tarjeta se tokenizan en el navegador contra Mercado Pago: nunca pasan
 * por nuestro servidor.
 */
export function CierreBrick(props: Props) {
  asegurarMercadoPago(props.publicKey);
  const [uiState, setUiState] = useState<CardBrickUiState>("INITIAL");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const enviandoRef = useRef(false);
  const amountMajor = props.amountMinor / 100;

  const onReady = useCallback(() => {
    setUiState("READY");
    setMensaje(null);
    try {
      const device = readMercadoPagoDeviceSessionId();
      console.info(
        JSON.stringify({
          event: "clf_cierre_brick_ready",
          DEVICE_SESSION_PRESENT: Boolean(device),
          deviceSessionIdLength: device?.length ?? 0,
        }),
      );
    } catch {
      // sin consecuencias: el envío vuelve a exigir la sesión de seguridad
    }
  }, []);

  const onError = useCallback((error: unknown) => {
    console.error(
      JSON.stringify({
        event: "clf_cierre_brick_error",
        name: error instanceof Error ? error.name : "BrickError",
        message: error instanceof Error ? error.message.slice(0, 160) : "brick_error",
      }),
    );
    setUiState("ERROR");
    setMensaje("No se pudo cargar el formulario de tarjeta. Revisá la consola del navegador.");
  }, []);

  const onSubmit = useCallback(
    async (formData: MercadoPagoCardPaymentBrickFormData) => {
      if (enviandoRef.current) return;
      enviandoRef.current = true;
      setUiState("SUBMITTING");
      setMensaje(null);
      try {
        const deviceSessionId = assertMercadoPagoDeviceSessionId();
        const submission = mapBrickFormDataToCardPaymentSubmission(
          formData,
          deviceSessionId,
        );
        setUiState("PROCESSING");
        const result = await crearOrdenCierreAction({
          cardPayment: submission,
          clientDisplayedAmountMinor: props.amountMinor,
          // Sondas: el servidor tiene que ignorarlas
          clientTotalMinor: 999_999_999,
          clientReceiverIds: ["deberia-ignorarse"],
        });

        if (!result.ok) {
          setUiState("ERROR");
          setMensaje(result.message);
          props.onResult({
            uiState: "ERROR",
            message: result.message,
            providerOrderId: null,
            status: null,
            statusDetail: null,
            liveMode: null,
            evidenciaPath: null,
          });
          enviandoRef.current = false;
          return;
        }

        setUiState(result.uiState);
        setMensaje(result.userMessage);
        props.onResult({
          uiState: result.uiState,
          message: result.userMessage,
          providerOrderId: result.providerOrderId,
          status: result.status,
          statusDetail: result.statusDetail,
          liveMode: result.liveMode,
          evidenciaPath: result.evidenciaPath,
        });
        enviandoRef.current = false;
      } catch (e) {
        const detalle = e instanceof Error ? e.message : "FALLO";
        const mensajeFallo = detalle.startsWith("DEVICE_SESSION")
          ? "Esperá a que el formulario inicialice la sesión de seguridad."
          : detalle.slice(0, 160);
        setUiState("ERROR");
        setMensaje(mensajeFallo);
        props.onResult({
          uiState: "ERROR",
          message: mensajeFallo,
          providerOrderId: null,
          status: null,
          statusDetail: null,
          liveMode: null,
          evidenciaPath: null,
        });
        enviandoRef.current = false;
      }
    },
    [props],
  );

  return (
    <div className="space-y-3">
      <CardPayment
        initialization={{
          amount: amountMajor,
          ...(props.payerEmail ? { payer: { email: props.payerEmail } } : {}),
        }}
        onSubmit={onSubmit}
        onReady={onReady}
        onError={onError}
      />
      {mensaje ? (
        <p
          className={
            uiState === "ERROR"
              ? "text-sm text-red-700"
              : "text-sm text-neutral-700"
          }
          role="status"
        >
          {mensaje}
        </p>
      ) : null}
    </div>
  );
}
