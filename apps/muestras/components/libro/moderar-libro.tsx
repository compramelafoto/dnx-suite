"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  GUESTBOOK_ENTRY_STATUS_LABELS, GUESTBOOK_MODES, GUESTBOOK_MODE_LABELS, formatArDay, guestbookSignature,
  type GuestbookEntryStatus,
} from "@repo/muestras";
import { cambiarModoLibro, moderarEntrada } from "@/lib/libro/acciones";
import { botonChico } from "@/components/montaje/estilos";

type Entrada = { id: string; name: string | null; city: string | null; comment: string; status: string; createdAt: Date };
type Filtro = GuestbookEntryStatus | "TODOS";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "PENDING", etiqueta: "Para revisar" },
  { valor: "PUBLISHED", etiqueta: "Publicados" },
  { valor: "HIDDEN", etiqueta: "Ocultos" },
  { valor: "TODOS", etiqueta: "Todos" },
];

/** El organizador elige cómo recibe comentarios y publica, oculta o borra cada uno. */
export function ModerarLibro({ id, modo, entradas }: { id: string; modo: string; entradas: Entrada[] }) {
  const router = useRouter();
  const [pendiente, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hayPendientes = entradas.some((e) => e.status === "PENDING");
  const [filtro, setFiltro] = useState<Filtro>(hayPendientes ? "PENDING" : "TODOS");
  const cuantos = (f: Filtro) => (f === "TODOS" ? entradas.length : entradas.filter((e) => e.status === f).length);
  const visibles = filtro === "TODOS" ? entradas : entradas.filter((e) => e.status === filtro);

  const ejecutar = (accion: () => Promise<{ ok: true } | { ok: false; error: string }>) => start(async () => {
    setError(null);
    const r = await accion();
    if (!r.ok) setError(r.error);
    router.refresh();
  });
  const borrar = (entryId: string) => {
    if (!window.confirm("¿Borrar este comentario? No se puede deshacer.")) return;
    ejecutar(() => moderarEntrada(entryId, "delete"));
  };

  return (
    <div className="space-y-8">
      <fieldset className="space-y-2 border-t border-[var(--mf-line)] pt-6" disabled={pendiente}>
        <legend className="mf-titulo pb-2 text-[1.5rem]">Cómo recibe comentarios</legend>
        {GUESTBOOK_MODES.map((m) => (
          <label key={m} className="flex items-center gap-3 text-[15px]">
            <input type="radio" name="modo" value={m} checked={modo === m} onChange={() => ejecutar(() => cambiarModoLibro(id, m))} />
            {GUESTBOOK_MODE_LABELS[m]}
          </label>
        ))}
      </fieldset>

      {error ? <p role="alert" className="text-[15px] text-[var(--mf-alerta)]">{error}</p> : null}

      <section aria-labelledby="t-comentarios" className="space-y-4">
        <h2 id="t-comentarios" className="mf-titulo text-[1.5rem]">Comentarios</h2>
        {entradas.length === 0 ? (
          <p className="text-[15px] text-[var(--mf-muted)]">Todavía no hay comentarios.</p>
        ) : (
          <>
            <div role="group" aria-label="Filtrar comentarios" className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <button
                  key={f.valor} type="button" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}
                  className={`${botonChico} ${filtro === f.valor ? "border-[var(--mf-ink)]" : ""}`}
                >
                  {f.etiqueta} ({cuantos(f.valor)})
                </button>
              ))}
            </div>
            {visibles.length === 0 ? (
              <p className="text-[15px] text-[var(--mf-muted)]">No hay comentarios con este filtro.</p>
            ) : (
              <ul className="border-t border-[var(--mf-line)]">
                {visibles.map((e) => (
                  <li key={e.id} className="space-y-2 border-b border-[var(--mf-line)] py-4">
                    <p className="whitespace-pre-line leading-relaxed">{e.comment}</p>
                    <p className="text-sm text-[var(--mf-muted)]">
                      {guestbookSignature(e)} · {formatArDay(e.createdAt)} · {GUESTBOOK_ENTRY_STATUS_LABELS[e.status as GuestbookEntryStatus] ?? e.status}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {e.status !== "PUBLISHED" ? (
                        <button type="button" className={botonChico} disabled={pendiente} onClick={() => ejecutar(() => moderarEntrada(e.id, "publish"))}>Publicar</button>
                      ) : null}
                      {e.status !== "HIDDEN" ? (
                        <button type="button" className={botonChico} disabled={pendiente} onClick={() => ejecutar(() => moderarEntrada(e.id, "hide"))}>Ocultar</button>
                      ) : null}
                      <button type="button" className={botonChico} disabled={pendiente} onClick={() => borrar(e.id)}>Borrar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}
