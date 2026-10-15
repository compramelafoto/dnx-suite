import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";

/** Las pestañas de Proyectos. */
export const PESTANAS_PROYECTOS = [
  { clave: "tablero", texto: "Tablero", href: "/proyectos" },
  { clave: "lista", texto: "Lista", href: "/proyectos/lista" },
] as const;
export type PestanaProyectos = (typeof PESTANAS_PROYECTOS)[number]["clave"];

/** Cabecera común de Proyectos: título y pestañas Tablero / Lista. */
export function ArmazonProyectos({ activa, children }: { activa: PestanaProyectos; children: ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title="Proyectos" description="Los trabajos de cada pedido, con sus etapas, tareas, fechas y equipo." />
      <nav aria-label="Vistas de Proyectos" className="flex gap-1 border-b border-[var(--fo-border)]">
        {PESTANAS_PROYECTOS.map((p) => (
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
      {children}
    </div>
  );
}
