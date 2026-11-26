"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { RespuestaRapida } from "@/lib/bandeja/respuestas-rapidas-puro";
import { borrarRespuestaAction, guardarRespuestaAction } from "./actions";

const VACIA = { id: undefined as string | undefined, atajo: "", titulo: "", texto: "" };

/** Lista de respuestas rápidas con alta, edición y borrado. */
export function EditorRespuestas({ respuestas }: { respuestas: RespuestaRapida[] }) {
  const router = useRouter();
  const [form, setForm] = useState(VACIA);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await guardarRespuestaAction(form).catch(() => ({ ok: false as const, error: "No se pudo guardar. Probá de nuevo." }));
      if (r.ok) {
        setForm(VACIA);
        router.refresh();
      } else setError(r.error);
    });
  }

  function borrar(id: string) {
    if (!window.confirm("¿Borrar esta respuesta rápida?")) return;
    iniciar(async () => {
      const r = await borrarRespuestaAction(id).catch(() => ({ ok: false as const, error: "No se pudo borrar." }));
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={guardar} className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">{form.id ? "Editar respuesta" : "Nueva respuesta"}</h2>
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="block">
            <span className="fo-label">Atajo</span>
            <span className="mt-1 flex items-center gap-1">
              <span className="text-[var(--fo-muted)]">/</span>
              <input className="fo-input" value={form.atajo} maxLength={30} required placeholder="carnet" onChange={(e) => setForm({ ...form, atajo: e.target.value })} />
            </span>
          </label>
          <label className="block">
            <span className="fo-label">Título</span>
            <input className="fo-input mt-1" value={form.titulo} maxLength={60} required placeholder="Precio de foto carnet" onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
        </div>
        <label className="block">
          <span className="fo-label">Texto</span>
          <textarea className="fo-input mt-1" rows={5} value={form.texto} maxLength={4096} required onChange={(e) => setForm({ ...form, texto: e.target.value })} />
          <span className="mt-1 block text-xs text-[var(--fo-muted)]">Podés usar {"{nombre}"}: se reemplaza por el primer nombre del cliente.</span>
        </label>
        {error ? <p role="alert" className="text-sm text-[var(--fo-danger)]">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
          {form.id ? (
            <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setForm(VACIA)}>
              Cancelar
            </button>
          ) : null}
        </div>
      </form>

      {respuestas.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Todavía no hay respuestas rápidas.</p>
      ) : (
        <ul className="divide-y divide-[var(--fo-border)] overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)]">
          {respuestas.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  <span className="text-[var(--fo-accent-hover)]">/{r.atajo}</span> · {r.titulo}
                </p>
                <p className="line-clamp-2 whitespace-pre-wrap text-sm text-[var(--fo-muted)]">{r.texto}</p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" className="text-sm text-[var(--fo-accent)] underline" onClick={() => setForm({ id: r.id, atajo: r.atajo, titulo: r.titulo, texto: r.texto })}>
                  Editar
                </button>
                <button type="button" className="text-sm text-[var(--fo-danger)] underline" disabled={pendiente} onClick={() => borrar(r.id)}>
                  Borrar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
