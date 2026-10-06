import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";

/** Las pestañas de Consultas. El Informe es la Tarea 11. */
export const PESTANAS_CAPTACION = [
  { clave: "tablero", texto: "Tablero", href: "/consultas" },
  { clave: "lista", texto: "Lista", href: "/consultas/lista" },
  { clave: "informe", texto: "Informe", href: "/consultas/informe" },
] as const;
export type PestanaCaptacion = (typeof PESTANAS_CAPTACION)[number]["clave"];

/**
 * Cabecera común de Consultas: título, botón "Nueva consulta" (sólo con "Gestionar" en
 * Consultas), pestañas y el aviso de las consultas por ordenar.
 */
export function ArmazonCaptacion({
  activa,
  quedan,
  puedeCrear = false,
  children,
}: {
  activa: PestanaCaptacion;
  quedan: number;
  puedeCrear?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Consultas"
        description="Consultas de presupuesto, organizadas por etapas."
        actions={
          puedeCrear ? (
            <Link href="/consultas/nueva" className="fo-btn fo-btn-primary text-sm">
              Nueva consulta
            </Link>
          ) : undefined
        }
      />
      <nav aria-label="Vistas de Consultas" className="flex gap-1 border-b border-[var(--fo-border)]">
        {PESTANAS_CAPTACION.map((p) => (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={p.clave === activa ? "page" : undefined}
            className={
              p.clave === activa
                ? "border-b-2 border-[var(--fo-accent)] px-3 py-2 text-sm font-medium text-[var(--fo-text)]"
                : "px-3 py-2 text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]"
            }
          >
            {p.texto}
          </Link>
        ))}
      </nav>
      {quedan > 0 ? (
        <p role="status" className="fo-card text-sm text-[var(--fo-muted)]">
          Estamos ordenando las consultas anteriores en sus etapas: quedan {quedan}. Actualizá la página en unos segundos.
        </p>
      ) : null}
      {children}
    </div>
  );
}
