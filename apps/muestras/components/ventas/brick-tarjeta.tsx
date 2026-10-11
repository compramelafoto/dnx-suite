"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  mapBrickFormDataToCardPaymentSubmission,
  readMercadoPagoDeviceSessionId,
  type MercadoPagoCardPaymentBrickFormData,
} from "@repo/payments/frontend";
import { pagarPedido } from "@/lib/ventas/pagar";
import { alerta, aviso, nota } from "./estilos";

/**
 * El pago con tarjeta (etapa 8, D36): el Card Payment Brick oficial de Mercado Pago cargado con su
 * script (sin `@mercadopago/sdk-react`). La tarjeta la tokeniza Mercado Pago en el navegador; acá
 * sólo viaja el token de un solo uso, que nunca se muestra ni se registra.
 */

// Lo mínimo del SDK que usamos (sin tipos nuevos).
type ControladorBrick = { unmount: () => void };
type Bricks = {
  create: (
    tipo: "cardPayment",
    contenedor: string,
    opciones: {
      initialization: { amount: number };
      customization: { paymentMethods: { maxInstallments: number } };
      callbacks: {
        onReady: () => void;
        onError: (error: unknown) => void;
        onSubmit: (formData: MercadoPagoCardPaymentBrickFormData) => Promise<void>;
      };
    },
  ) => Promise<ControladorBrick>;
};
type MercadoPagoSdk = new (publicKey: string, opciones: { locale: string }) => { bricks: () => Bricks };
declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

const CONTENEDOR = "brick-tarjeta";

function minutosQueQuedan(hasta: string, ahora: number): number {
  return Math.max(0, Math.ceil((new Date(hasta).getTime() - ahora) / 60_000));
}

/** "Bea María Compradora" → nombre "Bea María", apellido "Compradora". */
function partirNombre(nombre: string): { nombre: string; apellido: string } {
  const partes = nombre.trim().split(/\s+/);
  if (partes.length < 2) return { nombre: partes[0] ?? "", apellido: partes[0] ?? "" };
  return { nombre: partes.slice(0, -1).join(" "), apellido: partes[partes.length - 1]! };
}

export function BrickTarjeta({
  publicKey,
  publicId,
  token,
  totalArs,
  holdExpiresAt,
  nombreComprador,
  modoPrueba,
}: {
  publicKey: string;
  publicId: string;
  token: string;
  totalArs: number;
  holdExpiresAt: string;
  nombreComprador: string;
  modoPrueba: boolean;
}) {
  const router = useRouter();
  const [sdkListo, setSdkListo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const controlador = useRef<ControladorBrick | null>(null);
  const quedan = minutosQueQuedan(holdExpiresAt, ahora);
  const pedido = `/compras/${publicId}?t=${encodeURIComponent(token)}`;

  useEffect(() => {
    const id = window.setInterval(() => setAhora(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  const alPagar = useCallback(
    async (formData: MercadoPagoCardPaymentBrickFormData) => {
      setError(null);
      let envio;
      try {
        envio = mapBrickFormDataToCardPaymentSubmission(formData, readMercadoPagoDeviceSessionId() ?? "");
      } catch {
        setError("No pudimos preparar el pago. Recargá la página y probá de nuevo.");
        return;
      }
      const { nombre, apellido } = partirNombre(nombreComprador);
      const r = await pagarPedido({
        publicId,
        token,
        cardToken: envio.token,
        paymentMethodId: envio.paymentMethodId,
        installments: envio.installments,
        identification: envio.payer.identification ?? null,
        deviceSessionId: envio.deviceSessionId,
        payerFirstName: nombre,
        payerLastName: apellido,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.estado === "REJECTED") {
        setError(r.mensaje);
        return;
      }
      router.push(pedido);
    },
    [nombreComprador, pedido, publicId, router, token],
  );

  useEffect(() => {
    if (!sdkListo || !window.MercadoPago || quedan === 0) return;
    let cancelado = false;
    const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
    mp.bricks()
      .create("cardPayment", CONTENEDOR, {
        initialization: { amount: totalArs },
        customization: { paymentMethods: { maxInstallments: 1 } },
        callbacks: {
          onReady: () => {},
          onError: () => setError("Mercado Pago no pudo mostrar el formulario de la tarjeta. Recargá la página."),
          onSubmit: alPagar,
        },
      })
      .then((c) => {
        if (cancelado) c.unmount();
        else controlador.current = c;
      })
      .catch(() => setError("Mercado Pago no pudo mostrar el formulario de la tarjeta. Recargá la página."));
    return () => {
      cancelado = true;
      controlador.current?.unmount();
      controlador.current = null;
    };
    // El Brick se arma una vez por carga del SDK; `quedan` sólo importa para no armarlo vencido.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkListo, publicKey, totalArs, alPagar]);

  return (
    <div className="space-y-4">
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkListo(true)} />
      <p className="text-[15px]">
        Total: <strong>${totalArs.toLocaleString("es-AR")}</strong>
      </p>
      {quedan > 0 ? (
        <p className={nota}>Tenés {quedan} {quedan === 1 ? "minuto" : "minutos"} para pagar. Después, la copia vuelve a quedar libre.</p>
      ) : (
        <p className={alerta}>La reserva venció. Volvé a la obra para empezar de nuevo.</p>
      )}
      {modoPrueba ? <p className={aviso}>Modo prueba: usá una tarjeta de prueba de Mercado Pago.</p> : null}
      <div id={CONTENEDOR} />
      {error ? <p role="alert" className={alerta}>{error}</p> : null}
    </div>
  );
}
