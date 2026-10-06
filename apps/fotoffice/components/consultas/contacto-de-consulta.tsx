import Link from "next/link";
import type { ResumenContacto } from "@/lib/consultas/resumen-contacto";
import { claseDeColorEtiqueta, fechaBA } from "@/lib/ficha/formato";

/**
 * Notas, etiquetas y adjuntos del contacto en la ficha de la consulta: sólo para leer, con el
 * enlace "Ver ficha del contacto", donde se editan (spec §3.2, decisión).
 */
export function ContactoDeConsulta({ clientId, resumen }: { clientId: string; resumen: ResumenContacto }) {
  const { notas, etiquetas, adjuntos } = resumen;
  return (
    <section aria-labelledby="contacto-consulta-titulo" className="fo-card space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="contacto-consulta-titulo" className="text-base font-semibold text-[var(--fo-text)]">
          Del contacto
        </h2>
        <Link href={`/clientes/${clientId}`} className="text-xs font-medium text-[var(--fo-accent)] hover:underline">
          Ver ficha del contacto
        </Link>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-[var(--fo-muted)]">Etiquetas</p>
        {etiquetas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">—</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {etiquetas.map((e) => (
              <li key={e.id} className={`rounded px-2 py-0.5 text-xs font-medium ${claseDeColorEtiqueta(e.color)}`}>
                {e.nombre}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-[var(--fo-muted)]">Notas</p>
        {notas.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">—</p>
        ) : (
          <ul className="space-y-2">
            {notas.map((n) => (
              <li key={n.id} className="rounded border border-[var(--fo-border)] p-2 text-sm">
                <p className="whitespace-pre-line break-words text-[var(--fo-text)]">{n.texto}</p>
                <p className="mt-1 text-xs text-[var(--fo-muted)]">
                  {[n.fijada ? "Fijada" : null, n.categoria, n.autor || null, fechaBA(n.fecha)].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
        {resumen.masNotas ? (
          <Link href={`/clientes/${clientId}`} className="text-xs text-[var(--fo-accent)] hover:underline">
            Ver todas las notas
          </Link>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-[var(--fo-muted)]">Adjuntos</p>
        {adjuntos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">—</p>
        ) : (
          <ul className="space-y-0.5 text-sm">
            {adjuntos.map((a) => (
              <li key={a.id} className="break-words text-[var(--fo-text)]">
                {a.nombre} <span className="text-xs text-[var(--fo-muted)]">· {fechaBA(a.fecha)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
