import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EDITION_KIND_LABELS, OFFER_FORMAT_LABELS, OFFER_STATUS_LABELS, ORDER_STATUS_LABELS, isEditionKind, isOfferFormat, isOfferStatus, isOrderStatus,
} from "@repo/muestras";
import { ConfigurarVenta, EstadoDeVenta, QuienCobra } from "@/components/ventas/configurar-venta";
import { AccionesDeFormato, RevisionOfertas } from "@/components/ventas/revision-ofertas";
import { alerta, aviso, enlace, nota, seccion } from "@/components/ventas/estilos";
import { panelDeVentas, type PanelDeVentas } from "@/lib/ventas/consultas";
import { PEDIDO_PA } from "@/lib/ventas/evaluar";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ventas de la muestra" };

const ESTADO_VENTA: Record<string, string> = {
  DRAFT: "Sin abrir",
  OPEN: "Abierta",
  PAUSED: "Pausada",
  CLOSED: "Terminada (pasaron 30 días del cierre)",
};
const COBRO: Record<string, string> = {
  NONE: "sin conectar su Mercado Pago",
  PENDING: "falta que acepte en Mercado Pago",
  ACTIVE: "Mercado Pago conectado",
  REJECTED: "Mercado Pago no aceptado",
  CANCELED: "Mercado Pago revocado",
  EXPIRED: "invitación de Mercado Pago vencida",
};

function Modo({ p }: { p: PanelDeVentas }) {
  if (p.modo === "LIVE") return <p className={aviso}>Venta en vivo.</p>;
  if (p.modo === "TEST") return <p className={aviso}>Venta en prueba (sandbox): sólo vos y los probadores pueden comprar, con tarjetas de prueba.</p>;
  return (
    <p className={aviso}>
      Venta todavía no habilitada en la plataforma{p.esSuperAdmin && p.motivo ? `: ${p.motivo}` : "."} Podés dejar todo listo: se vende cuando se habilite.
    </p>
  );
}

const pesos = (n: number) => `$${n.toLocaleString("es-AR")}`;

export default async function VentasDeLaMuestra({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/muestras/${id}/ventas`);
  const p = await panelDeVentas(id, usuario);
  if (!p) notFound();
  const s = p.setup;
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${p.actividad.id}`} className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a la muestra</Link>
      <header className="space-y-2">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Ventas</h1>
        <p className="text-lg text-[var(--mf-muted)]">{p.actividad.title}</p>
      </header>
      <Modo p={p} />
      <section className="space-y-3">
        <p>Estado de la venta: <strong>{s ? ESTADO_VENTA[s.status] ?? s.status : "Sin configurar"}</strong></p>
        {p.edita ? <EstadoDeVenta activityId={p.actividad.id} status={s?.status ?? null} /> : null}
        {p.paraRevisar ? <p className={alerta}>{p.paraRevisar === 1 ? "Un formato para revisar." : `${p.paraRevisar} formatos para revisar.`}</p> : null}
      </section>

      {p.edita ? (
        <RevisionOfertas
          formatos={p.obras.flatMap((o) =>
            o.ofertas.filter((f) => f.status === "PROPOSED").map((f) => ({
              id: f.id, imageUrl: o.imageUrl, title: o.title, authorName: o.authorName, format: f.format, editionKind: f.editionKind,
              editionSize: f.editionSize, proofCount: f.proofCount, paper: f.paper, widthCm: f.widthCm, heightCm: f.heightCm,
              priceArs: f.priceArs, approvedPriceArs: f.approvedPriceArs, firstSoldAt: f.firstSoldAt,
            })))}
        />
      ) : null}

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Cuenta de cobro de la organización</h2>
        {s ? (
          <p className="text-[15px]">
            {p.cuentaOrganizacion?.consentStatus === "ACTIVE"
              ? `Mercado Pago conectado (${p.cuentaOrganizacion.mpEmail}).`
              : p.soyQuienCobra
                ? "Todavía no conectaste tu Mercado Pago."
                : `Quien cobra por la organización ${COBRO[p.cuentaOrganizacion?.consentStatus ?? "NONE"] ?? "no conectó su Mercado Pago"}.`}{" "}
            {p.soyQuienCobra ? <Link href="/panel/cobros" className={enlace}>Ir a Cobros</Link> : null}
          </p>
        ) : (
          <p className={nota}>Cuando guardes la configuración, cobra por la organización quien la organiza. <Link href="/panel/cobros" className={enlace}>Conectá tu Mercado Pago en Cobros</Link>.</p>
        )}
        {s && p.esDueno && p.edita ? <QuienCobra activityId={p.actividad.id} actual={s.organizerUserId} opciones={p.cobradores} /> : null}
      </section>

      <ConfigurarVenta
        activityId={p.actividad.id}
        edita={p.edita}
        inicial={{
          status: s?.status ?? "DRAFT",
          organizerBps: s?.organizerBps ?? null,
          photographerBps: s?.photographerBps ?? null,
          pickupText: s?.pickupText ?? null,
          shippingEnabled: s?.shippingEnabled ?? false,
          shippingCostArs: s?.shippingCostArs ?? null,
          shippingText: s?.shippingText ?? null,
          extraTerms: s?.extraTerms ?? null,
          organizerUserId: s?.organizerUserId ?? null,
        }}
      />

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Autores</h2>
        {p.autores.length === 0 ? (
          <p className={nota}>Todavía no hay obras para vender: aparecen las de expositores marcadas “La quiero vender” y las de concurso con la venta aceptada por su autor.</p>
        ) : (
          <ul className="border-t border-[var(--mf-line)]">
            {p.autores.map((a) => (
              <li key={a.userId} className="space-y-1 border-b border-[var(--mf-line)] py-3 text-[15px]">
                <p className="font-medium">{a.nombre}</p>
                <p className={nota}>
                  {a.aceptoVigente ? "Aceptó el reparto" : a.aceptoAlguna ? "Tiene que aceptar el reparto nuevo" : "Todavía no aceptó el reparto"} · {COBRO[a.cobro] ?? a.cobro} · {a.firma ? "firma cargada" : "falta su firma"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={seccion} id="obras">
        <h2 className="mf-titulo text-2xl">Obras y formatos</h2>
        {p.obras.length === 0 ? <p className={nota}>Sin obras para vender todavía.</p> : null}
        <ul className="space-y-6">
          {p.obras.map((o) => (
            <li key={o.activityWorkId} className="space-y-2 border-b border-[var(--mf-line)] pb-5">
              <p className="mf-titulo text-xl">{o.title}</p>
              <p className={nota}>
                {o.authorName} · Original: {o.original?.status === "READY" ? `listo (${o.original.widthPx} × ${o.original.heightPx} px)` : o.original?.status === "REJECTED" ? "rechazado" : "falta"}
              </p>
              {o.ofertas.length === 0 ? <p className={nota}>El autor todavía no propuso formatos.</p> : (
                <ul className="space-y-2">
                  {o.ofertas.map((f) => (
                    <li key={f.id} className="text-[15px]">
                      <p>
                        {isOfferFormat(f.format) ? OFFER_FORMAT_LABELS[f.format] : f.format} · {isEditionKind(f.editionKind) ? EDITION_KIND_LABELS[f.editionKind] : f.editionKind}
                        {f.editionKind === "LIMITED" ? ` de ${f.editionSize}` : ""}
                        {f.format === "PRINT" && f.paper ? ` · ${f.paper}, ${f.widthCm} × ${f.heightCm} cm` : ""} · {pesos(f.priceArs)} ·{" "}
                        <strong>{isOfferStatus(f.status) ? OFFER_STATUS_LABELS[f.status] : f.status}</strong>
                      </p>
                      <p className={nota}>
                        {f.evaluacion.vendidas} vendidas · quedan {f.evaluacion.quedan} de {f.editionSize}
                        {f.evaluacion.comprable.ok ? " · Se puede comprar" : ` · No se puede comprar: ${f.evaluacion.comprable.reasons.join("; ")}`}
                      </p>
                      {f.reviewNote ? <p className={nota}>{f.reviewNote.startsWith(PEDIDO_PA) ? f.reviewNote : `Nota para el autor: ${f.reviewNote}`}</p> : null}
                      {p.edita ? <AccionesDeFormato id={f.id} status={f.status} proofCount={f.proofCount} pidioPA={f.reviewNote?.startsWith(PEDIDO_PA) ?? false} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className={seccion}>
        <h2 className="mf-titulo text-2xl">Pedidos{p.modo === "TEST" ? " de prueba" : ""}</h2>
        {p.pedidos.length === 0 ? <p className={nota}>Todavía no hay pedidos.</p> : (
          <ul className="text-[15px]">
            {p.pedidos.map((x) => (
              <li key={x.status}>{isOrderStatus(x.status) ? ORDER_STATUS_LABELS[x.status] : x.status}: {x.cantidad} ({pesos(x.totalCents / 100)})</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
