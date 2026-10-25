"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { crearNotaAction } from "@/app/actions/ficha";
import type { CategoriaVista, PersonaFicha } from "./tipos";

const MAX = 4000;

type Estado = { error: string | null; enviadas: number };

/** La caja para escribir una nota nueva: categoría + texto. Se vacía al guardar. */
export function CajaDeNota({ persona, categorias }: { persona: PersonaFicha; categorias: CategoriaVista[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, enviar, enviando] = useActionState<Estado, FormData>(
    async (prev, fd) => {
      const r = await crearNotaAction(persona, {
        body: String(fd.get("body") ?? ""),
        categoryId: String(fd.get("categoryId") ?? ""),
      });
      return r.ok ? { error: null, enviadas: prev.enviadas + 1 } : { error: r.error, enviadas: prev.enviadas };
    },
    { error: null, enviadas: 0 },
  );

  // Guardada la nota, el texto se borra (la categoría queda elegida para la próxima).
  useEffect(() => {
    if (estado.enviadas === 0) return;
    const texto = formRef.current?.elements.namedItem("body");
    if (texto instanceof HTMLTextAreaElement) texto.value = "";
  }, [estado.enviadas]);

  if (categorias.length === 0) {
    return (
      <p className="fo-card p-4 text-sm text-[var(--fo-muted)]">
        No hay categorías de notas activas. Un administrador puede agregarlas en Configuración → Ficha.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      // Con onSubmit (y no `action`) React no vacía el formulario si la nota vuelve con error.
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => enviar(fd));
      }}
      className="fo-card space-y-3 p-4"
      aria-label="Escribir una nota"
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="fo-field-stack min-w-40 flex-1 sm:max-w-60">
          <label className="fo-label" htmlFor="nota-categoria">
            Categoría
          </label>
          <select id="nota-categoria" name="categoryId" className="fo-input" defaultValue={categorias[0]?.id} required>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="fo-field-stack">
        <label className="fo-label" htmlFor="nota-texto">
          Nota
        </label>
        <textarea
          id="nota-texto"
          name="body"
          className="fo-input min-h-24"
          maxLength={MAX}
          required
          placeholder="Escribí lo que haya que recordar de esta persona…"
          aria-describedby={estado.error ? "nota-error" : undefined}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        {estado.error ? (
          <p id="nota-error" role="alert" className="text-sm text-[var(--fo-danger)]">
            {estado.error}
          </p>
        ) : (
          <span className="text-xs text-[var(--fo-muted)]">Hasta 4.000 caracteres.</span>
        )}
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={enviando}>
          <Send className="size-4" aria-hidden />
          {enviando ? "Guardando…" : "Guardar nota"}
        </button>
      </div>
    </form>
  );
}
