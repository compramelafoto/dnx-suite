import Link from "next/link";
import { fechaCorta } from "@/lib/pedidos/pantalla";
import type { EntregaDeLaSemana } from "@/lib/proyectos/entregas-puro";

function textoDias(dias: number): string {
  if (dias < 0) return dias === -1 ? "Venció ayer" : `Venció hace ${-dias} días`;
  if (dias === 0) return "Hoy";
  return dias === 1 ? "Mañana" : `En ${dias} días`;
}

/**
 * Bloque "Mis entregas de la semana" del inicio: los proyectos propios con fecha final en los
 * próximos 7 días o ya vencida. Cada uno enlaza a su ficha.
 */
export function MisEntregas({ entregas }: { entregas: EntregaDeLaSemana[] }) {
  return (
    <section aria-labelledby="mis-entregas-titulo" className="fo-card space-y-3">
      <h2 id="mis-entregas-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Mis entregas de la semana
      </h2>
      <ul className="space-y-2">
        {entregas.map((e) => (
          <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <Link href={`/proyectos/${encodeURIComponent(e.id)}`} className="min-w-0 truncate font-medium text-[var(--fo-accent)] hover:underline">
              {e.nombre}
              <span className="ml-1 text-xs font-normal text-[var(--fo-muted)]">N° {e.numero}</span>
            </Link>
            <span className={`text-xs ${e.dias < 0 ? "font-medium text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"}`}>
              {textoDias(e.dias)} · {fechaCorta(e.finalDueDate)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
