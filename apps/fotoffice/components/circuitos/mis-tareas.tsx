"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { tildarTareaAction } from "@/app/actions/circuitos";
import type { MisTareasInicio, TareaInicio } from "@/lib/circuitos/inicio";
import { fechaBA } from "@/lib/ficha/formato";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";

const GRUPOS = [
  { clave: "vencidas", titulo: "Vencidas", clase: "text-[var(--fo-danger)]" },
  { clave: "hoy", titulo: "Hoy", clase: "text-[var(--fo-text)]" },
  { clave: "proximas", titulo: "Próximos 7 días", clase: "text-[var(--fo-text)]" },
] as const;

/**
 * Bloque "Mis tareas" del inicio: las tareas pendientes asignadas a quien entra, en tres grupos.
 * Se tildan en línea (la tarea tildada desaparece) y cada una enlaza a su registro.
 */
export function MisTareas({ grupos }: { grupos: MisTareasInicio }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [hechas, setHechas] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  function tildar(t: TareaInicio) {
    setError(null);
    setHechas((s) => new Set(s).add(t.id));
    const volver = () =>
      setHechas((s) => {
        const n = new Set(s);
        n.delete(t.id);
        return n;
      });
    iniciar(async () => {
      try {
        const r = await tildarTareaAction({ taskId: t.id, hecha: true });
        if (!r.ok) {
          volver();
          setError(r.error);
          return;
        }
        router.refresh();
      } catch {
        volver();
        setError(MENSAJE_FALLA);
      }
    });
  }

  return (
    <section aria-labelledby="mis-tareas-titulo" className="fo-card space-y-4">
      <h2 id="mis-tareas-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Mis tareas
      </h2>
      {GRUPOS.map((g) => {
        const tareas = grupos[g.clave].filter((t) => !hechas.has(t.id));
        if (tareas.length === 0) return null;
        return (
          <div key={g.clave} className="space-y-2">
            <h3 className={`text-sm font-medium ${g.clase}`}>
              {g.titulo} ({tareas.length})
            </h3>
            <ul className="space-y-2">
              {tareas.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={false}
                    disabled={pendiente}
                    aria-label={`Tildar ${t.titulo}`}
                    onChange={() => tildar(t)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[var(--fo-text)]">
                      {t.titulo}
                      {t.obligatoria ? <span className="ml-1 text-xs text-[var(--fo-danger)]">(obligatoria)</span> : null}
                    </p>
                    <p className="text-xs text-[var(--fo-muted)]">
                      Vence {fechaBA(t.vence)}
                      {t.etapa ? ` · ${t.etapa}` : ""}
                      {t.sujeto ? (
                        <>
                          {" · "}
                          <Link href={t.sujeto.href} className="text-[var(--fo-accent)] hover:underline">
                            {t.sujeto.titulo}
                          </Link>
                        </>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
