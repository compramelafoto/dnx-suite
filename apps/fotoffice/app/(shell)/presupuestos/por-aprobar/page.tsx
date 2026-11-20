import { EnlaceCliente } from "@/components/entidades/enlace-cliente";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { AprobarCotizacion, UltimoResultadoAprobacion } from "@/components/presupuestos/aprobar-cotizacion";
import { PestanasCotizaciones } from "@/components/presupuestos/pestanas-cotizaciones";
import { DIAS_PARA_ARCHIVAR, listarPorAprobar } from "@/lib/presupuesto-automatico/por-aprobar";
import { requirePresupuestos } from "@/lib/presupuestos/pagina";

export const dynamic = "force-dynamic";
/** «Aprobar y enviar» manda el WhatsApp y el correo en la misma acción. */
export const maxDuration = 60;

const fecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const CANAL = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram", WEB: "Web" } as const;

/**
 * Cotizaciones → Por aprobar: las que armó el bot y esperan aprobación, de la más nueva a la más
 * vieja. «Abrir» lleva al presupuesto (para corregirlo), «Aprobar y enviar» manda al cliente (el
 * mismo camino que Telegram) y «Descartar» la archiva. Las de más de 14 días se archivan solas.
 * Con "Gestionar" en Presupuestos. Nunca muestra costos.
 */
export default async function PorAprobarPage() {
  const { workspace } = await requirePresupuestos("operar");
  const filas = await listarPorAprobar(workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader entidad="cotizacion" title="Cotizaciones" description="Las que armó el bot y esperan tu aprobación antes de llegarle al cliente." />
      <PestanasCotizaciones activa="por-aprobar" porAprobar={filas.length} />
      <UltimoResultadoAprobacion key={filas.map((f) => f.id).join(",")} />

      {filas.length === 0 ? (
        <p className="fo-card text-sm text-[var(--fo-muted)]">No hay cotizaciones esperando aprobación.</p>
      ) : (
        <ul className="fo-card divide-y divide-[var(--fo-border)] p-0">
          {filas.map((f) => (
            <li key={f.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 space-y-0.5">
                <p className="font-medium text-[var(--fo-text)]">
                  <EnlaceCliente clientId={f.clientId}>{f.cliente}</EnlaceCliente>
                  {f.categoria ? <span className="font-normal text-[var(--fo-muted)]"> · {f.categoria}</span> : null}
                </p>
                <p className="text-xs text-[var(--fo-muted)]">
                  Consulta del {fecha.format(f.fecha)} · {CANAL[f.origen]}
                  {f.sinAviso ? " · no se pudo avisar por Telegram" : ""}
                  {f.errorCode === "SIN_CANAL" ? " · la última vez no había por dónde mandarla" : ""}
                </p>
                {f.precio ? <p className="tabular-nums text-[var(--fo-text)]">{f.precio}</p> : null}
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Link href={`/presupuestos/${encodeURIComponent(f.presupuestoId)}`} className="fo-btn fo-btn-secondary text-xs">
                  Abrir
                </Link>
                <AprobarCotizacion aprobacionId={f.id} presupuestoId={f.presupuestoId} conDescartar compacto />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--fo-muted)]">Las que esperan más de {DIAS_PARA_ARCHIVAR} días se archivan solas y dejan de aparecer acá.</p>
    </div>
  );
}
