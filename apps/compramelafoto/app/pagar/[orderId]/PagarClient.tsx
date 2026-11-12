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
import { conTipoDeTarjeta } from "@/lib/split-1n-piloto/tarjeta";
import { pagarGrupo } from "@/lib/split-1n-carrito-evento/pagar-grupo";
import PlanBMercadoPago from "./PlanBMercadoPago";
import VolverATarjeta from "../grupo/[grupoId]/VolverATarjeta";

type Props = {
  publicKey: string;
  /** Pedido del piloto de un álbum, o `grupoId` de un carrito de evento (uno de los dos). */
  orderId?: number;
  grupoId?: string;
  totalPesos: number;
  /** Correo a medias, sólo para mostrar: el servidor usa el del pedido. */
  correoVisible: string;
  volverA: string;
  volverTexto?: string;
  /** Ofrecer «Pagar con Mercado Pago» (pedido de un álbum o carrito de evento). */
  planB?: boolean;
  /**
   * El carrito ya tiene una orden de Mercado Pago con reparto que se puede pagar: se ofrece
   * seguir ahí y no la tarjeta (que no cobraría mientras esa orden siga vigente).
   */
  soloMercadoPago?: boolean;
  /** Con `soloMercadoPago`: ofrecer cancelar Mercado Pago y volver a la tarjeta. */
  permitirTarjeta?: boolean;
};

type Estado =
  | { tipo: "formulario"; mensaje: string | null }
  | { tipo: "enviando" }
  | { tipo: "acreditada"; descargaUrl: string | null }
  | { tipo: "en_revision" };

let mpInicializadaPara: string | null = null;

function asegurarMercadoPago(publicKey: string) {
  if (!publicKey || mpInicializadaPara === publicKey) return;
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
    async (
      formData: MercadoPagoCardPaymentBrickFormData,
      additionalData?: { paymentTypeId?: string },
    ) => {
      if (enviandoRef.current) return;
      enviandoRef.current = true;
      setEstado({ tipo: "enviando" });
      try {
        const deviceSessionId = assertMercadoPagoDeviceSessionId();
        const cardPayment = mapBrickFormDataToCardPaymentSubmission(
          conTipoDeTarjeta(formData, additionalData),
          deviceSessionId,
        );
        const r = props.grupoId
          ? await pagarGrupo({ grupoId: props.grupoId, cardPayment })
          : await pagarPedidoPiloto({ pedidoId: props.orderId ?? 0, cardPayment });
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
    [props.orderId, props.grupoId],
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

  const mostrarMercadoPago = Boolean(
    props.planB && (props.orderId || props.grupoId) && estado.tipo === "formulario",
  );
  const botonMercadoPago = props.grupoId ? (
    <PlanBMercadoPago
      grupoId={props.grupoId}
      destacado
      {...(props.soloMercadoPago ? { texto: "Seguir pagando con Mercado Pago" } : {})}
    />
  ) : (
    <PlanBMercadoPago pedidoId={props.orderId!} destacado />
  );

  if (mostrarMercadoPago && props.soloMercadoPago) {
    return (
      <div className="space-y-3">
        {botonMercadoPago}
        <p className="text-center text-sm text-neutral-600">
          Si ya pagaste en Mercado Pago, esperá unos minutos y recargá la página: no pagues de nuevo.
        </p>
        {props.grupoId && props.publicKey && props.permitirTarjeta ? <VolverATarjeta grupoId={props.grupoId} /> : null}
        <p className="text-center text-sm">
          <Link href={props.volverA} className="text-neutral-600 underline">
            {props.volverTexto ?? "Volver al resumen de la compra"}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mercado Pago primero: es lo que más usan los compradores (dinero en cuenta, tarjetas
          guardadas). No mientras se procesa la tarjeta, para no pagar dos veces. */}
      {mostrarMercadoPago ? (
        <>
          {botonMercadoPago}
          <div className="flex items-center gap-3 py-2 text-sm text-neutral-500" aria-hidden="true">
            <span className="h-px flex-1 bg-neutral-200" />
            o pagá con tarjeta
            <span className="h-px flex-1 bg-neutral-200" />
          </div>
        </>
      ) : null}
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
          {props.volverTexto ?? "Volver al resumen de la compra"}
        </Link>
      </p>
    </div>
  );
}
