"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { borrarTareaAction, crearTareaAction, tildarTareaAction } from "@/app/actions/circuitos";
import { finDelDiaElegido, tildeVisible, type Tilde, type TareaFicha } from "@/lib/circuitos/ficha-vista";
import { fechaBA } from "@/lib/ficha/formato";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";
const TITULO_MAX = 200;

/**
 * Tareas de la ficha: las de la etapa actual, las agregadas a mano y las pendientes de etapas
 * anteriores. Se tildan en línea; las agregadas a mano ("sueltas") también se borran. Con el
 * recorrido cerrado no se agregan tareas nuevas.
 */
export function Tareas({ journeyId, tareas, abierto }: { journeyId: string; tareas: TareaFicha[]; abierto: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState("");
  // Tilde optimista: se ve al instante, se corrige si el servidor lo rechaza y cede en cuanto
  // llegan datos nuevos del servidor (guarda el valor sobre el que se tildó).
  const [tildes, setTildes] = useState<Record<string, Tilde>>({});

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void, alFallar?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError(r.error ?? MENSAJE_FALLA);
          alFallar?.();
          return;
        }
        alTerminar?.();
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
        alFallar?.();
      }
    });
  }

  function tildar(t: TareaFicha, hecha: boolean) {
    setTildes((x) => ({ ...x, [t.id]: { valor: hecha, base: t.hecha } }));
    const volver = () =>
      setTildes((x) => {
        const resto = { ...x };
        delete resto[t.id];
        return resto;
      });
    correr(() => tildarTareaAction({ taskId: t.id, hecha }), undefined, volver);
  }

  function agregar() {
    const limpio = titulo.trim();
    if (!limpio) return;
    const dueAt = fecha ? finDelDiaElegido(fecha) : null;
    if (fecha && !dueAt) {
      setError("La fecha no es válida.");
      return;
    }
    correr(
      () => crearTareaAction({ journeyId, titulo: limpio, dueAt: dueAt ? dueAt.toISOString() : null }),
      () => {
        setTitulo("");
        setFecha("");
      },
    );
  }

  function borrar(t: TareaFicha) {
    if (!window.confirm(`¿Borrar la tarea «${t.titulo}»?`)) return;
    correr(() => borrarTareaAction({ taskId: t.id }));
  }

  return (
    <section aria-labelledby="tareas-titulo" className="fo-card space-y-3">
      <h2 id="tareas-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Tareas
      </h2>
      {tareas.length === 0 ? <p className="text-sm text-[var(--fo-muted)]">No hay tareas.</p> : null}
      <ul className="space-y-2">
        {tareas.map((t) => {
          const hecha = tildeVisible(t.hecha, tildes[t.id]);
          return (
            <li key={t.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={hecha}
                disabled={pendiente}
                aria-label={`${hecha ? "Destildar" : "Tildar"} ${t.titulo}`}
                onChange={(ev) => tildar(t, ev.target.checked)}
              />
              <div className="min-w-0 flex-1">
                <p className={hecha ? "text-[var(--fo-muted)] line-through" : "text-[var(--fo-text)]"}>
                  {t.titulo}
                  {t.obligatoria ? <span className="ml-1 text-xs text-[var(--fo-danger)]">(obligatoria)</span> : null}
                </p>
                <p className="text-xs text-[var(--fo-muted)]">
                  {[
                    t.vence ? `Vence ${fechaBA(t.vence)}` : null,
                    t.vencida && !hecha ? "Vencida" : null,
                    t.suelta ? "Agregada a mano" : t.deEtapaAnterior ? `Quedó de ${t.etapa}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {t.suelta ? (
                <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente} onClick={() => borrar(t)} aria-label={`Borrar ${t.titulo}`}>
                  Borrar
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      {abierto ? (
        <form
          className="flex flex-wrap items-end gap-2 border-t border-[var(--fo-border)] pt-3 text-sm"
          onSubmit={(ev) => {
            ev.preventDefault();
            agregar();
          }}
        >
          <label className="fo-field-stack min-w-0 flex-1">
            <span className="fo-label">Nueva tarea</span>
            <input className="fo-input" maxLength={TITULO_MAX} value={titulo} onChange={(ev) => setTitulo(ev.target.value)} />
          </label>
          <label className="fo-field-stack">
            <span className="fo-label">Vence (opcional)</span>
            <input type="date" className="fo-input" value={fecha} onChange={(ev) => setFecha(ev.target.value)} />
          </label>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || !titulo.trim()}>
            Agregar
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
