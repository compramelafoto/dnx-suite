"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { agregarNotaAction, borrarNotaAction, editarNotaAction } from "@/app/actions/proyectos";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { NotaVista } from "@/lib/proyectos/ficha-vista";

const MENSAJE_FALLA = "No se pudo guardar el cambio. Probá de nuevo.";
const NOTA_MAXIMA = 5000;

/** Notas del proyecto: la más nueva primero. Con "Gestionar" se agregan; el autor (o un administrador) las edita y las borra. */
export function NotasProyecto({ proyectoId, notas, puedeAgregar }: { proyectoId: string; notas: NotaVista[]; puedeAgregar: boolean }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [texto, setTexto] = useState("");
  const [editando, setEditando] = useState<{ id: string; texto: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      try {
        const r = await accion();
        if (!r.ok) {
          setError(r.error);
          return;
        }
        alTerminar?.();
        router.refresh();
      } catch {
        setError(MENSAJE_FALLA);
      }
    });
  }

  return (
    <section aria-labelledby="notas-proyecto-titulo" className="fo-card space-y-3">
      <h2 id="notas-proyecto-titulo" className="text-base font-semibold text-[var(--fo-text)]">
        Notas
      </h2>

      {puedeAgregar ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            correr(() => agregarNotaAction(proyectoId, texto), () => setTexto(""));
          }}
        >
          <label className="fo-field-stack">
            <span className="fo-label">Nueva nota</span>
            <textarea className="fo-input" rows={3} maxLength={NOTA_MAXIMA} value={texto} onChange={(e) => setTexto(e.target.value)} />
          </label>
          <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente || texto.trim() === ""}>
            Agregar nota
          </button>
        </form>
      ) : null}

      {notas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay notas.</p>
      ) : (
        <ul className="space-y-3">
          {notas.map((n) => (
            <li key={n.id} className="space-y-1 rounded border border-[var(--fo-border)] p-3 text-sm">
              {editando?.id === n.id ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    correr(() => editarNotaAction(proyectoId, n.id, editando.texto), () => setEditando(null));
                  }}
                >
                  <textarea
                    className="fo-input"
                    rows={3}
                    maxLength={NOTA_MAXIMA}
                    aria-label="Texto de la nota"
                    value={editando.texto}
                    onChange={(e) => setEditando({ id: n.id, texto: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <button type="submit" className="fo-btn fo-btn-primary text-xs" disabled={pendiente || editando.texto.trim() === ""}>
                      Guardar
                    </button>
                    <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => setEditando(null)}>
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="whitespace-pre-line break-words text-[var(--fo-text)]">{n.texto}</p>
                  <p className="text-xs text-[var(--fo-muted)]">
                    {n.autor ? `${n.autor} · ` : ""}
                    {fechaHoraBA(n.fecha)}
                    {n.editada ? " · editada" : ""}
                  </p>
                  {n.puedeModificar ? (
                    <div className="flex gap-2">
                      <button type="button" className="fo-btn fo-btn-ghost text-xs" disabled={pendiente} onClick={() => setEditando({ id: n.id, texto: n.texto })}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="fo-btn fo-btn-ghost text-xs"
                        disabled={pendiente}
                        onClick={() => {
                          if (window.confirm("¿Borrar esta nota?")) correr(() => borrarNotaAction(proyectoId, n.id));
                        }}
                      >
                        Borrar
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
