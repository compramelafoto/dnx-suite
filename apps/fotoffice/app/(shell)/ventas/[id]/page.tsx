import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireSalesAssistantManager } from "@/lib/sales-assistant/access";
import { resumenConexionAlboom } from "@/lib/sales-assistant/alboom/credentials";
import {
  ETIQUETA_ACCION,
  ETIQUETA_RESULTADO,
  type EstadoSugerencia,
  type TipoSeguimiento,
} from "@/lib/sales-assistant/constants";
import { fechaHoraVenta, fechaVenta, textoEnDias } from "@/lib/sales-assistant/format";
import { diasEntre } from "@/lib/sales-assistant/needs-analysis";
import type { Movimiento } from "@/lib/sales-assistant/opportunity";
import { detalleOportunidad } from "@/lib/sales-assistant/repository";
import { AccionesDetalle } from "../acciones-rapidas";

export const dynamic = "force-dynamic";
/** "Volver a analizar" corre la sincronización dentro de la acción: mismo límite que la bandeja. */
export const maxDuration = 300;

const ETIQUETA_ESTADO: Record<EstadoSugerencia, string> = {
  PENDIENTE: "Pendiente",
  ENVIADA: "Enviada",
  POSPUESTA: "Pospuesta",
  DESCARTADA: "Descartada",
  REEMPLAZADA: "Reemplazada por una más nueva",
};

const ETIQUETA_MOVIMIENTO: Record<Movimiento["tipo"], string> = {
  ETAPA: "Cambio de etapa en Alboom",
  CORREO: "Correo en Alboom",
  NOTA: "Nota en Alboom",
  OTRO: "Movimiento en Alboom",
};

const ETIQUETA_SEGUIMIENTO: Record<TipoSeguimiento, string> = {
  MENSAJE_ENVIADO: "Mensaje por WhatsApp",
  RESULTADO: "Respuesta",
  NOTA: "Nota",
};

type Evento = { clave: string; fecha: Date; titulo: string; texto: string | null; quien: string | null };

/**
 * El detalle de una oportunidad: sus datos, lo que pasó (en Alboom y acá, mezclado por fecha) y
 * lo que el asistente fue sugiriendo. Una oportunidad de otro workspace no existe: `notFound()`.
 */
export default async function DetalleVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { workspace } = await requireSalesAssistantManager();
  const { id } = await params;

  const [detalle, conexion] = await Promise.all([
    detalleOportunidad(workspace.id, id),
    resumenConexionAlboom(workspace.id),
  ]);
  if (!detalle) notFound();

  const { oportunidad: op } = detalle;
  const ahora = new Date();

  const linea: Evento[] = [
    ...op.movimientos.map((m, i) => ({
      clave: `m-${i}`,
      fecha: m.fecha,
      titulo: ETIQUETA_MOVIMIENTO[m.tipo],
      texto: m.texto,
      quien: null,
    })),
    ...detalle.seguimientos.map((f) => ({
      clave: `f-${f.id}`,
      fecha: f.creadaEn,
      titulo: f.outcome
        ? `${ETIQUETA_SEGUIMIENTO[f.kind]}: ${ETIQUETA_RESULTADO[f.outcome]}`
        : ETIQUETA_SEGUIMIENTO[f.kind],
      texto: f.text,
      quien: f.actorLabel,
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const alboomUrl = conexion?.subdomain
    ? `https://${conexion.subdomain}.alboomcrm.com/#/leads/view/${encodeURIComponent(op.idExterno)}`
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={[op.nombreCliente, op.apellidoCliente].filter(Boolean).join(" ")}
        description={op.titulo}
        actions={
          <Link href="/ventas" className="fo-btn fo-btn-secondary min-h-11">
            Volver a la bandeja
          </Link>
        }
      />

      {detalle.archivada ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm">
          Archivada en el asistente. En Alboom sigue como estaba.
        </p>
      ) : detalle.externalStatus !== "ABIERTA" ? (
        <p className="fo-alert-warning rounded-[var(--fo-radius-sm)] p-3 text-sm">
          Ya no está abierta en Alboom, así que no aparece en la bandeja.
        </p>
      ) : null}

      <section className="fo-card space-y-4 p-5">
        <h2 className="text-base font-semibold">La oportunidad</h2>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Dato label="Tipo de evento" valor={op.tipoEvento ?? "—"} />
          <Dato
            label="Fecha del evento"
            valor={
              op.fechaEvento
                ? `${fechaVenta(op.fechaEvento)} (${textoEnDias(diasEntre(ahora, op.fechaEvento))})`
                : "—"
            }
          />
          <Dato label="Lugar" valor={[op.lugar, op.ciudad].filter(Boolean).join(", ") || "—"} />
          <Dato label="Invitados" valor={op.invitados ?? "—"} />
          <Dato label="Teléfono" valor={op.telefono ?? "—"} />
          <Dato label="Correo" valor={op.email ?? "—"} />
          <Dato label="Embudo" valor={op.embudo} />
          <Dato label="Etapa" valor={`${op.etapa} (${op.etapaOrden} de ${op.etapasTotal})`} />
          <Dato label="Entró el" valor={fechaVenta(op.creadaEn)} />
          <Dato
            label="Presupuesto enviado"
            valor={op.presupuestoEnviadoEn ? fechaVenta(op.presupuestoEnviadoEn) : "—"}
          />
          <Dato label="Cómo llegó" valor={op.origen ?? "—"} />
          {op.descripcionCliente ? <Dato label="Lo que escribió" valor={op.descripcionCliente} ancho /> : null}
        </dl>
        {alboomUrl ? (
          <a href={alboomUrl} target="_blank" rel="noopener noreferrer" className="fo-btn fo-btn-ghost min-h-11">
            Ver en Alboom
          </a>
        ) : null}
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Qué hacer</h2>
        <AccionesDetalle opportunityId={id} archivada={detalle.archivada} />
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Lo que pasó</h2>
        {linea.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay movimientos.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {linea.map((e) => (
              <li key={e.clave} className="space-y-0.5">
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraVenta(e.fecha)}
                  {e.quien ? ` · ${e.quien}` : ""}
                </p>
                <p className="font-medium">{e.titulo}</p>
                {e.texto ? <p className="whitespace-pre-line text-[var(--fo-text-secondary)]">{e.texto}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Sugerencias del asistente</h2>
        {detalle.sugerencias.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hubo ninguna.</p>
        ) : (
          <ul className="space-y-4 text-sm">
            {detalle.sugerencias.map((s) => (
              <li key={s.id} className="space-y-1 border-b border-[var(--fo-border-muted)] pb-3 last:border-0 last:pb-0">
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraVenta(s.creadaEn)} · {ETIQUETA_ESTADO[s.estado]}
                </p>
                <p className="font-medium">{ETIQUETA_ACCION[s.accion]}</p>
                <p className="text-[var(--fo-text-secondary)]">{s.motivo}</p>
                {s.editedMessage ?? s.mensaje ? (
                  <p className="whitespace-pre-line rounded-lg bg-[var(--fo-surface-muted)] p-3">
                    {s.editedMessage ?? s.mensaje}
                  </p>
                ) : null}
                {s.editedMessage ? (
                  <p className="text-xs text-[var(--fo-muted)]">Se mandó con cambios tuyos.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dato({ label, valor, ancho }: { label: string; valor: string; ancho?: boolean }) {
  return (
    <div className={`min-w-0 space-y-0.5 ${ancho ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs text-[var(--fo-muted)]">{label}</dt>
      <dd className="whitespace-pre-line break-words">{valor}</dd>
    </div>
  );
}
