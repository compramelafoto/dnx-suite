import {
  DELIVERY_LABELS, FULFILLMENT_LABELS, OFFER_FORMAT_LABELS, ORDER_STATUS_LABELS, formatArClock, formatArDay, isDelivery, isFulfillment,
  isOfferFormat, isOrderStatus,
} from "@repo/muestras";
import type { PedidoDelPanel } from "@/lib/ventas/pedidos-consultas";
import { alerta, enlace, nota } from "./estilos";
import { DevolverPago, PedirDevolucion, SiguientePaso } from "./pedidos-panel";

const pesos = (cents: number) => `$${(cents / 100).toLocaleString("es-AR")}`;
const fecha = (d: Date) => `${formatArDay(d)} ${formatArClock(d)}`;

function direccion(x: unknown): string | null {
  if (!x || typeof x !== "object") return null;
  const d = x as Record<string, string | null>;
  return [`${d.calle ?? ""} ${d.numero ?? ""}`.trim(), d.pisoDepto, d.ciudad, d.provincia, d.codigoPostal].filter(Boolean).join(", ");
}

/** Un pedido en el panel: quién compró, qué, cuánto y cómo se reparte, la producción y el historial. */
export function TarjetaPedido({ p, esDueno, esSuperAdmin, conMuestra = false }: { p: PedidoDelPanel; esDueno: boolean; esSuperAdmin: boolean; conMuestra?: boolean }) {
  const impresa = p.delivery === "PICKUP" || p.delivery === "SHIPPING";
  const pagado = p.status === "PAID";
  const devolucionPendiente = (p.refundRequestedAt || p.regretRequestedAt) && !p.refundedAt;
  return (
    <li className="space-y-2 border-b border-[var(--mf-line)] py-4 text-[15px]">
      <p className={nota}>
        {fecha(p.createdAt)}{conMuestra ? ` · ${p.muestra}` : ""}{p.isTest ? " · Prueba" : ""}
      </p>
      <p className="font-medium">
        {p.obra?.title ?? "Obra"} · {p.formato && isOfferFormat(p.formato) ? OFFER_FORMAT_LABELS[p.formato] : p.formato}
        {p.detalleFormato ? ` (${p.detalleFormato})` : ""}{p.numero ? ` · ${p.numero}` : ""}
      </p>
      <p>
        Estado: <strong>{isOrderStatus(p.status) ? ORDER_STATUS_LABELS[p.status] : p.status}</strong>
        {impresa && pagado ? ` · ${isFulfillment(p.fulfillment) ? FULFILLMENT_LABELS[p.fulfillment] : p.fulfillment}` : ""}
      </p>
      {p.status === "PAID_NO_COPY" ? <p className={alerta}>Cobrado sin copia disponible: hay que devolver el pago.</p> : null}
      {p.regretRequestedAt && !p.refundedAt ? <p className={alerta}>Quien compró pidió el arrepentimiento el {formatArDay(p.regretRequestedAt)}.</p> : null}
      {p.refundRequestedAt && !p.refundedAt ? <p className={alerta}>Devolución pedida el {formatArDay(p.refundRequestedAt)}.</p> : null}
      {p.alertas.length ? <p className={alerta}>Alertas: {p.alertas.join(", ")}</p> : null}
      {p.alertas.includes("ALERT_UNKNOWN_CREATE") && !p.providerOrderId ? (
        <p className={alerta}>
          Conciliar a mano: no sabemos si Mercado Pago creó la Order. El barrido la busca solo por su referencia; si no aparece, buscala en Mercado Pago por {`muestras-venta-${p.publicId}`}.
        </p>
      ) : null}
      {p.alertas.includes("ALERT_PAID_ON_TERMINAL") ? <p className={alerta}>Mercado Pago cobró un pedido rechazado: hay que devolver el pago.</p> : null}
      <p>
        {p.buyerName} · {p.buyerEmail}{p.buyerPhone ? ` · ${p.buyerPhone}` : ""}
        {p.buyerOnCertificate ? " · figura en el certificado" : ""}
      </p>
      <p>
        {isDelivery(p.delivery) ? DELIVERY_LABELS[p.delivery] : p.delivery}
        {p.delivery === "SHIPPING" && direccion(p.shippingAddress) ? `: ${direccion(p.shippingAddress)}` : ""}
        {p.trackingText ? ` · ${p.trackingText}` : ""}
      </p>
      <p>
        Total {pesos(p.totalCents)} · plataforma {pesos(p.platformCents)} · organización {pesos(p.organizerCents)} · fotógrafo/a {pesos(p.photographerCents)}
        {p.shippingArs > 0 ? ` · incluye envío $${p.shippingArs.toLocaleString("es-AR")}` : ""}
      </p>
      <div className="flex flex-wrap items-start gap-3">
        {impresa && pagado ? <SiguientePaso orderId={p.id} delivery={p.delivery} fulfillment={p.fulfillment} /> : null}
        {p.obra && impresa && pagado ? <a href={`/api/ventas/archivo/${p.obra.id}`} className={enlace}>Bajar original para imprimir</a> : null}
        {pagado && p.copia?.status === "ISSUED" && p.copia.certificateCode ? (
          <>
            <a href={`/api/ventas/certificado/${p.id}`} className={enlace}>Certificado (PDF)</a>
            {impresa ? <a href={`/api/ventas/etiqueta/${p.id}`} className={enlace}>Etiqueta del dorso (PDF)</a> : null}
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-3">
        {esDueno && (pagado || p.status === "PAID_NO_COPY") && !p.refundRequestedAt ? <PedirDevolucion orderId={p.id} /> : null}
        {esSuperAdmin && (((pagado || p.status === "PAID_NO_COPY") && (devolucionPendiente || p.status === "PAID_NO_COPY" || p.isTest)) || (p.status === "REJECTED" && p.refundRequestedAt && p.providerOrderId))
          ? <DevolverPago orderId={p.id} />
          : null}
      </div>
      {p.historial.length ? (
        <details>
          <summary className="cursor-pointer text-sm text-[var(--mf-muted)]">Historial</summary>
          <ul className="mt-2 space-y-1 text-sm text-[var(--mf-muted)]">
            {p.historial.map((e, i) => (
              <li key={i}>{fecha(e.createdAt)} · {e.source}{e.fromStatus || e.toStatus ? ` · ${e.fromStatus ?? ""} → ${e.toStatus ?? ""}` : ""}{e.detail ? ` · ${e.detail}` : ""}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
