import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Las piezas del tablero de inicio de la institución. Sin datos ni consultas: sólo forma, para
 * que cada bloque se vea igual venga del módulo que venga.
 */

const TONOS = {
  neutral: "text-[var(--fo-text)]",
  success: "text-[var(--fo-success)]",
  warning: "text-[var(--fo-warning)]",
  danger: "text-[var(--fo-danger)]",
} as const;

export type Tono = keyof typeof TONOS;

/** Un número de un vistazo. Si tiene `href`, toda la tarjeta lleva a la pantalla que lo explica. */
export function Indicador({
  rotulo,
  valor,
  detalle,
  tono = "neutral",
  href,
}: {
  rotulo: string;
  valor: string;
  detalle?: string | null;
  tono?: Tono;
  href?: string;
}) {
  const cuerpo = (
    <>
      <p className="text-xs font-medium text-[var(--fo-muted)]">{rotulo}</p>
      <p className={`mt-1 whitespace-nowrap text-lg font-semibold leading-tight tabular-nums sm:text-2xl ${TONOS[tono]}`}>{valor}</p>
      {detalle ? <p className="mt-0.5 text-xs leading-snug text-[var(--fo-muted)]">{detalle}</p> : null}
    </>
  );
  const clase = "fo-card block min-w-0 p-4";
  return href ? (
    <Link href={href} className={`${clase} transition-colors hover:border-[var(--fo-accent)]`}>
      {cuerpo}
    </Link>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

/** Un bloque del tablero con título, acción a la derecha y contenido. */
export function Panel({
  titulo,
  accion,
  children,
  className = "",
}: {
  titulo: string;
  accion?: { label: string; href: string } | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`fo-card space-y-4 p-5 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">{titulo}</h2>
        {accion ? (
          <Link
            href={accion.href}
            className="shrink-0 text-sm font-medium text-[var(--fo-accent-hover)] hover:underline"
          >
            {accion.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export type Pendiente = {
  /** Qué hay que hacer, dicho como tarea. */
  texto: string;
  href: string;
  tono?: Tono;
  /** Cantidad, cuando la hay: se muestra a la izquierda, grande. */
  cantidad?: number;
};

/**
 * Lo que espera una acción de alguien del equipo. Va arriba de todo: un tablero que muestra
 * números lindos y esconde que hay tres solicitudes de alta esperando no sirve.
 */
export function ListaPendientes({ items }: { items: Pendiente[] }) {
  if (items.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--fo-radius-sm)] bg-[var(--fo-success-soft)] px-4 py-3 text-sm text-[var(--fo-success)]">
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8 12.5l2.5 2.5L16 9.5" />
        </svg>
        No hay nada esperando. Todo al día.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-[var(--fo-border)]">
      {items.map((p) => (
        <li key={p.href + p.texto}>
          <Link
            href={p.href}
            className="flex items-center gap-3 py-2.5 text-sm transition-colors hover:text-[var(--fo-accent-hover)]"
          >
            {p.cantidad !== undefined ? (
              <span
                className={`grid min-w-9 place-items-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${
                  p.tono === "danger"
                    ? "bg-[var(--fo-danger-soft)] text-[var(--fo-danger)]"
                    : p.tono === "warning"
                      ? "bg-[var(--fo-warning-soft)] text-[var(--fo-warning)]"
                      : "bg-[var(--fo-accent-soft)] text-[var(--fo-accent-hover)]"
                }`}
              >
                {p.cantidad}
              </span>
            ) : null}
            <span className="min-w-0 flex-1">{p.texto}</span>
            <span aria-hidden className="text-[var(--fo-muted-soft)]">›</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Una barra de proporción simple: cuántos de un total, con su número al lado. */
export function Barra({ valor, total, tono = "success" }: { valor: number; total: number; tono?: Tono }) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  const color =
    tono === "danger"
      ? "bg-[var(--fo-danger)]"
      : tono === "warning"
        ? "bg-[var(--fo-warning)]"
        : tono === "success"
          ? "bg-[var(--fo-success)]"
          : "bg-[var(--fo-accent)]";
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--fo-surface-muted)]" role="presentation">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-[var(--fo-muted)]">{pct}%</span>
    </div>
  );
}
