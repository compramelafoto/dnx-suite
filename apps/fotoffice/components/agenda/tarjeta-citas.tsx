import Link from "next/link";
import { ETIQUETA_ESTADO_CITA, type EstadoCita } from "@/lib/agenda/constantes";
import type { CitaDeFicha, CitasDeFicha } from "@/lib/agenda/de-origen";

const FECHA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "short" });
const HORA = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false });

function cuando(c: CitaDeFicha): string {
  const inicio = new Date(c.inicio);
  const dia = FECHA.format(inicio);
  return c.todoElDia ? `${dia} · todo el día` : `${dia} · ${HORA.format(inicio)}`;
}

function Fila({ c }: { c: CitaDeFicha }) {
  return (
    <li className="py-2 first:pt-0 last:pb-0">
      <Link
        href={`/agenda?fecha=${c.dia}&cita=${encodeURIComponent(c.id)}`}
        className="block rounded-[var(--fo-radius-sm)] hover:bg-[var(--fo-surface-hover)]"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: c.color }} />
          <span className="min-w-0 flex-1 truncate font-medium text-[var(--fo-text)]">{c.titulo}</span>
        </span>
        <span className="mt-0.5 block pl-[1.125rem] text-xs text-[var(--fo-muted)]">
          {cuando(c)}
          {c.tipo ? ` · ${c.tipo}` : ""}
          {c.estado !== "AGENDADA" ? ` · ${ETIQUETA_ESTADO_CITA[c.estado as EstadoCita] ?? c.estado}` : ""}
        </span>
      </Link>
    </li>
  );
}

/**
 * Tarjeta "Citas" de la ficha de un proyecto, un pedido o una consulta: las próximas y las
 * recientes, cada una con enlace a la Agenda en ese día. Con "Gestionar" en Agenda ofrece "Nueva
 * cita", que abre la Agenda con el diálogo de alta ya ligado a este registro.
 */
export function TarjetaCitas({
  citas,
  nueva,
  vacio = "Todavía no hay citas.",
}: {
  citas: CitasDeFicha;
  /** Parámetro que liga la cita nueva al registro: `proyecto=ID`, `pedido=ID` o `consulta=ID`. */
  nueva: string;
  vacio?: string;
}) {
  const hay = citas.proximas.length + citas.recientes.length > 0;
  return (
    <section aria-labelledby="tarjeta-citas-titulo" className="fo-card space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tarjeta-citas-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
          Citas
        </h2>
        {citas.puedeAgendar ? (
          <Link href={`/agenda?nueva=1&${nueva}`} className="fo-btn fo-btn-ghost text-xs">
            Nueva cita
          </Link>
        ) : null}
      </div>
      {!hay ? <p className="text-sm text-[var(--fo-muted)]">{vacio}</p> : null}
      {citas.proximas.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--fo-muted)]">Próximas</p>
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {citas.proximas.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </ul>
        </div>
      ) : null}
      {citas.recientes.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--fo-muted)]">Recientes</p>
          <ul className="divide-y divide-[var(--fo-border)] text-sm">
            {citas.recientes.map((c) => (
              <Fila key={c.id} c={c} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
