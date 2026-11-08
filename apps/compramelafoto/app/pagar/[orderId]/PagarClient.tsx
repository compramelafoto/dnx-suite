"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import {
  assertMercadoPagoDeviceSessionId,
  mapBrickFormDataToCardPaymentSubmission,
  type MercadoPagoCardPaymentBrickFormData,
} from "@repo/payments/frontend";
import { pagarPedidoPiloto } from "@/lib/split-1n-piloto/pagar";

type Props = {
  publicKey: string;
  orderId: number;
  totalPesos: number;
  /** Correo a medias, sólo para mostrar: el servidor usa el del pedido. */
  correoVisible: string;
  volverA: string;
};

type Estado =
  | { tipo: "formulario"; mensaje: string | null }
  | { tipo: "enviando" }
  | { tipo: "acreditada"; descargaUrl: string | null }
  | { tipo: "en_revision" };

let mpInicializadaPara: string | null = null;

function asegurarMercadoPago(publicKey: string) {
  if (mpInicializadaPara === publicKey) return;
  initMercadoPago(publicKey, { locale: "es-AR" });
  mpInicializadaPara = publicKey;
}

/**
 * Pago con tarjeta del piloto Split 1:N. Los datos de la tarjeta se tokenizan en el navegador
 * contra Mercado Pago; al servidor sólo llega el token. El monto y el reparto los fija el
 * servidor desde el pedido.
 */
export default function PagarClient(props: Props) {
  asegurarMercadoPago(props.publicKey);
  const [estado, setEstado] = useState<Estado>({ tipo: "formulario", mensaje: null });
  const enviandoRef = useRef(false);

  const onSubmit = useCallback(
    async (formData: MercadoPagoCardPaymentBrickFormData) => {
      if (enviandoRef.current) return;
      enviandoRef.current = true;
      setEstado({ tipo: "enviando" });
      try {
        const deviceSessionId = assertMercadoPagoDeviceSessionId();
        const cardPayment = mapBrickFormDataToCardPaymentSubmission(formData, deviceSessionId);
        const r = await pagarPedidoPiloto({ pedidoId: props.orderId, cardPayment });
        if (r.ok && r.estado === "ACREDITADA") {
          setEstado({ tipo: "acreditada", descargaUrl: r.descargaUrl });
        } else if (r.ok) {
          setEstado({ tipo: "en_revision" });
        } else {
          setEstado({ tipo: "formulario", mensaje: r.mensaje });
          enviandoRef.current = false;
        }
      } catch (e) {
        const detalle = e instanceof Error ? e.message : "";
        setEstado({
          tipo: "formulario",
          mensaje: detalle.startsWith("DEVICE_SESSION")
            ? "Esperá unos segundos a que cargue el formulario y volvé a intentar."
            : "No pudimos procesar el pago. No se te cobró nada; probá de nuevo.",
        });
        enviandoRef.current = false;
      }
    },
    [props.orderId],
  );

  const onError = useCallback(() => {
    setEstado({
      tipo: "formulario",
      mensaje: "No se pudo cargar el formulario de tarjeta. Recargá la página.",
    });
  }, []);

  if (estado.tipo === "acreditada") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-xl font-semibold text-emerald-700">¡Listo! Tu pago se acreditó.</p>
        <p className="text-neutral-700">
          Te mandamos el comprobante y el enlace de descarga a {props.correoVisible}.
        </p>
        {estado.descargaUrl ? (
          <a
            href={estado.descargaUrl}
            className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white"
          >
            Descargar mis fotos
          </a>
        ) : null}
      </div>
    );
  }

  if (estado.tipo === "en_revision") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold">Tu pago está en revisión.</p>
        <p className="text-neutral-700">
          Mercado Pago lo está verificando. Cuando se acredite te llega un correo a{" "}
          {props.correoVisible} con tus fotos. No hace falta que pagues de nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <CardPayment
        initialization={{ amount: props.totalPesos }}
        onSubmit={onSubmit}
        onError={onError}
      />
      {estado.tipo === "enviando" ? (
        <p className="text-sm text-neutral-700" role="status">
          Procesando el pago, no cierres esta página…
        </p>
      ) : null}
      {estado.tipo === "formulario" && estado.mensaje ? (
        <p className="text-sm text-red-700" role="alert">
          {estado.mensaje}
        </p>
      ) : null}
      <p className="text-center text-sm">
        <Link href={props.volverA} className="text-neutral-600 underline">
          Volver al resumen de la compra
        </Link>
      </p>
    </div>
  );
}
