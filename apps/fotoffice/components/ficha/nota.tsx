"use client";

import { useState, useTransition } from "react";
import { Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { borrarNotaAction, editarNotaAction, fijarNotaAction } from "@/app/actions/ficha";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { CategoriaVista, NotaVista, PersonaFicha, Resultado } from "./tipos";

/**
 * Una nota de la línea de tiempo. Editar y borrar sólo si `puedeModificar` (autor o
 * administrador); fijar, cualquiera del equipo. El servidor vuelve a decidir en cada acción.
 */
export function Nota({
  persona,
  nota,
  categorias,
}: {
  persona: PersonaFicha;
  nota: NotaVista;
  categorias: CategoriaVista[];
}) {
  const [modo, setModo] = useState<"ver" | "editar" | "borrar">("ver");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function correr(accion: () => Promise<Resultado>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
      else alTerminar?.();
    });
  }

  const titulo = `Nota · ${nota.categoria}`;

  return (
    <article
      className={`rounded-xl border p-3 ${nota.pinned ? "border-[var(--fo-accent)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] bg-[var(--fo-surface)]"}`}
      aria-label={nota.pinned ? `${titulo} (fijada)` : titulo}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 text-sm">
          <p className="font-medium text-[var(--fo-text)]">
            {nota.pinned ? <Pin className="mr-1 inline size-3.5 text-[var(--fo-accent)]" aria-label="Fijada" /> : null}
            {titulo}
            {nota.editada ? <span className="ml-1 text-xs font-normal text-[var(--fo-muted)]">(editada)</span> : null}
          </p>
          <p className="text-xs text-[var(--fo-muted)]">
            {nota.autor ? `${nota.autor} · ` : ""}
            <time dateTime={nota.fecha}>{fechaHoraBA(nota.fecha)}</time>
          </p>
        </div>
        {modo === "ver" ? (
          <div className="flex items-center">
            <button
              type="button"
              className="fo-icon-btn"
              disabled={pendiente}
              onClick={() => correr(() => fijarNotaAction(persona, nota.id, !nota.pinned))}
              aria-label={nota.pinned ? "Desfijar nota" : "Fijar nota arriba"}
              title={nota.pinned ? "Desfijar" : "Fijar arriba"}
            >
              {nota.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
            </button>
            {nota.puedeModificar ? (
              <>
                <button type="button" className="fo-icon-btn" onClick={() => setModo("editar")} aria-label="Editar nota" title="Editar">
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="fo-icon-btn fo-icon-btn-danger"
                  onClick={() => setModo("borrar")}
                  aria-label="Borrar nota"
                  title="Borrar"
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </header>

      {modo === "editar" ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const categoria = String(fd.get("categoryId") ?? "");
            correr(
              () =>
                editarNotaAction(persona, nota.id, {
                  body: String(fd.get("body") ?? ""),
                  // Sin cambio de categoría no se manda: las notas importadas no tienen una activa.
                  categoryId: categoria && categoria !== nota.categoryId ? categoria : undefined,
                }),
              () => setModo("ver"),
            );
          }}
        >
          <label className="sr-only" htmlFor={`nota-cat-${nota.id}`}>
            Categoría
          </label>
          <select
            id={`nota-cat-${nota.id}`}
            name="categoryId"
            className="fo-input"
            defaultValue={categorias.some((c) => c.id === nota.categoryId) ? (nota.categoryId ?? "") : ""}
          >
            {categorias.some((c) => c.id === nota.categoryId) ? null : <option value="">{nota.categoria} (sin cambiar)</option>}
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor={`nota-body-${nota.id}`}>
            Texto de la nota
          </label>
          <textarea
            id={`nota-body-${nota.id}`}
            name="body"
            className="fo-input min-h-24"
            defaultValue={nota.body}
            maxLength={4000}
            required
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setModo("ver")} disabled={pendiente}>
              Cancelar
            </button>
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente}>
              {pendiente ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[var(--fo-text)]">{nota.body}</p>
      )}

      {modo === "borrar" ? (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-sm" role="group" aria-label="Confirmar borrado">
          <span className="text-[var(--fo-text-secondary)]">¿Borrar esta nota? Queda registrado quién la borró.</span>
          <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setModo("ver")} disabled={pendiente}>
            Cancelar
          </button>
          <button
            type="button"
            className="fo-btn fo-btn-danger text-sm"
            disabled={pendiente}
            onClick={() => correr(() => borrarNotaAction(persona, nota.id), () => setModo("ver"))}
          >
            {pendiente ? "Borrando…" : "Borrar"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-2 text-sm text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </article>
  );
}
