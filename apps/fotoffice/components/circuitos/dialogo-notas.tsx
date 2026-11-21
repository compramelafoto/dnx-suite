"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Pin, StickyNote, X } from "lucide-react";
import { crearNotaAction, notasDelClienteAction, type NotaDeVentana } from "@/app/actions/ficha";
import { fechaHoraBA } from "@/lib/ficha/formato";

const MAX_CARACTERES = 4000;
/** Categoría que se propone primero, si existe (DNX usa "Otro"; el resto, "General"). */
const PREFERIDAS = ["General", "Otro"];

type Estado =
  | { fase: "cargando" }
  | { fase: "error"; mensaje: string }
  | { fase: "lista"; notas: NotaDeVentana[]; categorias: { id: string; nombre: string }[]; puedeEscribir: boolean };

/**
 * Las notas del cliente de una tarjeta: el historial (fijadas primero, después de la más nueva a
 * la más vieja) y un campo para dejar una nueva. Se guardan en las notas del cliente, las mismas
 * que se ven en su ficha. `cliente` null = la ventana está cerrada. Quien la usa le pone
 * `key={cliente?.id}` para que cada cliente arranque con la ventana vacía.
 */
export function DialogoNotas({
  cliente,
  onCerrar,
}: {
  cliente: { id: string; titulo: string } | null;
  /** `huboCambios`: se guardó al menos una nota (el tablero vuelve a contar). */
  onCerrar: (huboCambios: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [texto, setTexto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [aviso, setAviso] = useState("");
  const [guardando, iniciar] = useTransition();
  const cambios = useRef(false);
  const abierto = cliente !== null;
  const clienteId = cliente?.id ?? null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  useEffect(() => {
    if (!clienteId) return;
    // El tablero monta una ventana nueva por cliente (`key`): el estado ya arranca limpio.
    let vigente = true;
    notasDelClienteAction(clienteId)
      .then((r) => {
        if (!vigente) return;
        if (!r.ok) {
          setEstado({ fase: "error", mensaje: r.error });
          return;
        }
        setEstado({ fase: "lista", notas: r.notas, categorias: r.categorias, puedeEscribir: r.puedeEscribir });
        const preferida = r.categorias.find((c) => PREFERIDAS.includes(c.nombre)) ?? r.categorias[0];
        setCategoria((actual) => (r.categorias.some((c) => c.id === actual) ? actual : (preferida?.id ?? "")));
        if (r.puedeEscribir) requestAnimationFrame(() => campo.current?.focus());
      })
      .catch(() => {
        if (vigente) setEstado({ fase: "error", mensaje: "No se pudieron cargar las notas. Probá de nuevo." });
      });
    return () => {
      vigente = false;
    };
  }, [clienteId]);

  function guardar() {
    if (!clienteId || guardando) return;
    const cuerpo = texto.trim();
    if (!cuerpo) {
      setAviso("Escribí la nota.");
      return;
    }
    setAviso("");
    iniciar(async () => {
      try {
        const r = await crearNotaAction({ tipo: "CLIENTE", id: clienteId }, { body: cuerpo, categoryId: categoria });
        if (!r.ok) {
          setAviso(r.error);
          return;
        }
        cambios.current = true;
        setTexto("");
        const nuevas = await notasDelClienteAction(clienteId);
        if (nuevas.ok) setEstado({ fase: "lista", notas: nuevas.notas, categorias: nuevas.categorias, puedeEscribir: nuevas.puedeEscribir });
        campo.current?.focus();
      } catch {
        setAviso("No se pudo guardar la nota. Probá de nuevo.");
      }
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialogo-notas-titulo"
      className="fo-card m-auto w-[92vw] max-w-lg p-0 backdrop:bg-black/50"
      onClose={() => {
        if (abierto) onCerrar(cambios.current);
      }}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <header className="flex items-start gap-3 border-b border-[var(--fo-border-muted)] px-5 pb-3 pt-4">
          <StickyNote className="mt-0.5 size-5 shrink-0 text-[var(--fo-accent)]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id="dialogo-notas-titulo" className="text-base font-semibold text-[var(--fo-text)]">
              Notas del cliente
            </h2>
            {cliente ? <p className="truncate text-sm text-[var(--fo-muted)]">{cliente.titulo}</p> : null}
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)] hover:text-[var(--fo-text)]"
            onClick={() => ref.current?.close()}
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </header>

        {estado.fase === "lista" && estado.puedeEscribir ? (
          <form
            className="space-y-2 border-b border-[var(--fo-border-muted)] px-5 py-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              guardar();
            }}
          >
            <label htmlFor="nota-nueva" className="text-xs font-medium text-[var(--fo-muted)]">
              Nueva nota
            </label>
            <textarea
              id="nota-nueva"
              ref={campo}
              className="fo-input min-h-24 w-full resize-y text-sm"
              maxLength={MAX_CARACTERES}
              placeholder="Escribí acá lo que quieras recordar de este cliente…"
              value={texto}
              onChange={(ev) => setTexto(ev.target.value)}
              onKeyDown={(ev) => {
                // Cmd/Ctrl + Enter guarda sin ir al botón.
                if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
                  ev.preventDefault();
                  guardar();
                }
              }}
              disabled={guardando}
            />
            <div className="flex flex-wrap items-center gap-2">
              {estado.categorias.length > 1 ? (
                <label className="flex items-center gap-2 text-xs text-[var(--fo-muted)]">
                  Categoría
                  <select
                    className="fo-input h-8 min-h-0! w-auto! py-0! pr-8! text-xs"
                    value={categoria}
                    onChange={(ev) => setCategoria(ev.target.value)}
                    disabled={guardando}
                  >
                    {estado.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="submit" className="fo-btn fo-btn-primary ml-auto text-sm" disabled={guardando || texto.trim().length === 0}>
                {guardando ? "Guardando…" : "Guardar nota"}
              </button>
            </div>
            {aviso ? (
              <p role="alert" className="text-xs text-[var(--fo-danger)]">
                {aviso}
              </p>
            ) : null}
          </form>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 [scrollbar-width:thin]">
          {estado.fase === "cargando" ? (
            <p className="text-sm text-[var(--fo-muted)]">Cargando notas…</p>
          ) : estado.fase === "error" ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {estado.mensaje}
            </p>
          ) : estado.notas.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay notas sobre este cliente.</p>
          ) : (
            <ol className="space-y-3" aria-label="Historial de notas">
              {estado.notas.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-[var(--fo-radius-sm)] border p-3 text-sm ${
                    n.fijada ? "border-[var(--fo-accent-muted)] bg-[var(--fo-accent-soft)]" : "border-[var(--fo-border)] bg-[var(--fo-surface)]"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--fo-muted)]">
                    {n.fijada ? <Pin className="size-3 text-[var(--fo-accent)]" aria-label="Fijada" /> : null}
                    <time dateTime={n.fecha} className="tabular-nums">
                      {fechaHoraBA(n.fecha)}
                    </time>
                    {n.autor ? <span>· {n.autor}</span> : null}
                    {n.categoria ? (
                      <span className="rounded-full bg-[var(--fo-surface-muted)] px-1.5 py-0.5 font-medium text-[var(--fo-text-secondary)]">{n.categoria}</span>
                    ) : null}
                    {n.editada ? <span>(editada)</span> : null}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-[var(--fo-text)]">{n.texto}</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {cliente ? (
          <footer className="border-t border-[var(--fo-border-muted)] px-5 py-2.5 text-right">
            <Link href={`/clientes/${cliente.id}`} className="text-xs font-medium text-[var(--fo-accent-hover)] hover:underline">
              Ver la ficha del cliente
            </Link>
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}
