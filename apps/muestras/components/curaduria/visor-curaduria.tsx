"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CALL_TEXT_LIMITS, CURATOR_FILTERS, SCORE_MAX, SCORE_MIN, curatorProgress, filterForCurator, type CuratorFilter, type CuratorWorkView } from "@repo/muestras";
import { puntuar } from "@/lib/curaduria/acciones";
import { campo, enlace } from "@/components/convocatorias/estilos";

const PUNTAJES = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i);

/** Mientras se escribe (la nota u otro campo), las teclas del visor no hacen nada. */
function esCampoDeTexto(t: EventTarget | null): t is HTMLElement {
  return t instanceof HTMLTextAreaElement || t instanceof HTMLInputElement || t instanceof HTMLSelectElement || (t instanceof HTMLElement && t.isContentEditable);
}

/**
 * El visor del curador. Teclado: 1 a 5 puntúa, ← y → pasan de obra, N escribe una nota (Escape
 * vuelve). El filtro arma la lista una vez, al elegirlo: puntuar una obra en "Me faltan" no la
 * saca de abajo de los ojos (lección del visor de FotoRank).
 *
 * Sólo recibe `CuratorWorkView` (código, título, año, técnica, texto y la ruta propia de la
 * imagen): nada del autor ni la URL del bucket.
 */
export function VisorCuraduria({ obras: iniciales, soloLectura }: { obras: CuratorWorkView[]; soloLectura: boolean }) {
  const [obras, setObras] = useState(iniciales);
  const [filtro, setFiltro] = useState<CuratorFilter>("TODAS");
  const [ids, setIds] = useState(() => iniciales.map((o) => o.id));
  const [pos, setPos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [guardando, setGuardando] = useState(0);
  const visor = useRef<HTMLDivElement>(null);
  const nota = useRef<HTMLTextAreaElement>(null);
  const porId = useMemo(() => new Map(obras.map((o) => [o.id, o])), [obras]);
  const actual = ids[pos] ? porId.get(ids[pos]) : undefined;
  const avance = curatorProgress(obras);

  const elegirFiltro = (f: CuratorFilter) => {
    setFiltro(f);
    setIds(filterForCurator(obras, f).map((o) => o.id));
    setPos(0);
  };
  const ir = useCallback(
    (paso: number) => setPos((p) => Math.min(Math.max(p + paso, 0), Math.max(ids.length - 1, 0))),
    [ids.length],
  );

  const guardar = useCallback(async (score: number, texto: string) => {
    if (!actual || soloLectura) return;
    const antes = actual;
    setObras((xs) => xs.map((o) => (o.id === antes.id ? { ...o, myScore: score, myNote: texto } : o)));
    setGuardando((n) => n + 1);
    setAviso("Guardando…");
    let r: Awaited<ReturnType<typeof puntuar>>;
    try {
      r = await puntuar(antes.id, score, texto);
    } catch {
      r = { ok: false, errores: ["No se pudo guardar. Revisá la conexión y probá de nuevo."] };
    }
    setGuardando((n) => n - 1);
    if (!r.ok) {
      setError(r.errores.join(" "));
      setAviso("");
      // Se vuelve atrás sólo si nadie cambió esa obra mientras tanto.
      setObras((xs) => xs.map((o) => (o.id === antes.id && o.myScore === score && o.myNote === texto ? antes : o)));
    } else {
      setError(null);
      setAviso(`Guardado: ${antes.code}, puntaje ${score}.`);
    }
  }, [actual, soloLectura]);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (esCampoDeTexto(e.target)) {
        // Escape sale de la nota (el onBlur la guarda) y el foco vuelve al visor.
        if (e.key === "Escape") {
          e.preventDefault();
          e.target.blur();
          visor.current?.focus();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") { e.preventDefault(); ir(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); ir(-1); }
      else if (/^[1-5]$/.test(e.key) && actual && !soloLectura) {
        e.preventDefault();
        if (!e.repeat) void guardar(Number(e.key), actual.myNote);
      }
      else if (e.key.toLowerCase() === "n" && actual && !soloLectura) {
        e.preventDefault();
        if (actual.myScore == null) setAviso("Primero poné un puntaje; después podés escribir la nota.");
        else nota.current?.focus();
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [ir, guardar, actual, soloLectura]);

  // La siguiente imagen se pide antes de llegar: pasar de obra no espera la red.
  useEffect(() => {
    const sig = ids[pos + 1] ? porId.get(ids[pos + 1]) : undefined;
    if (sig) new Image().src = sig.imagePath;
  }, [ids, pos, porId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Qué obras mostrar" className="flex gap-4 text-[15px]">
          {CURATOR_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filtro === f.id}
              className={filtro === f.id ? "underline underline-offset-[6px]" : "text-[var(--mf-muted)]"}
              onClick={() => elegirFiltro(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="text-[15px] tabular-nums">Puntuaste {avance.scored} de {avance.total}</p>
      </div>

      {!actual ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">
          {filtro === "ME_FALTAN" ? "No te falta ninguna. ¡Gracias!" : "No hay obras para mostrar."}
        </p>
      ) : (
        <div
          ref={visor}
          tabIndex={-1}
          aria-label="Visor de obras"
          className="grid gap-6 outline-none lg:grid-cols-[minmax(0,1fr)_20rem]"
        >
          <figure className="flex h-[min(75vh,48rem)] items-center justify-center bg-[#0f171d]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={actual.id}
              src={actual.imagePath}
              alt={`Obra ${actual.code}`}
              referrerPolicy="no-referrer"
              draggable={false}
              className="max-h-full max-w-full object-contain"
            />
          </figure>
          <div className="space-y-5">
            <p className="text-sm text-[var(--mf-muted)] tabular-nums" aria-live="polite">
              {actual.code}. Obra {pos + 1} de {ids.length}
            </p>
            <div className="space-y-1">
              <h2 className="mf-titulo text-2xl">{actual.title}</h2>
              <p className="text-[13px] text-[var(--mf-muted)]">{[actual.year, actual.technique].filter(Boolean).join(". ")}</p>
              {actual.statement ? <p className="text-[15px] leading-snug">{actual.statement}</p> : null}
            </div>
            <div role="radiogroup" aria-label={`Puntaje de ${SCORE_MIN} a ${SCORE_MAX}`} className="flex gap-2">
              {PUNTAJES.map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={actual.myScore === n}
                  aria-keyshortcuts={String(n)}
                  disabled={soloLectura}
                  className={`size-11 rounded-[2px] border text-lg tabular-nums disabled:opacity-60 ${actual.myScore === n ? "border-[var(--mf-ink)] bg-[var(--mf-ink)] text-[var(--mf-bg)]" : "border-[var(--mf-line)]"}`}
                  onClick={() => void guardar(n, actual.myNote)}
                >
                  {n}
                </button>
              ))}
            </div>
            <label className="block space-y-1">
              <span className="text-sm">Nota (optativa, la lee quien organiza)</span>
              <textarea
                key={`nota-${actual.id}`}
                ref={nota}
                rows={4}
                maxLength={CALL_TEXT_LIMITS.note}
                aria-keyshortcuts="N"
                defaultValue={actual.myNote}
                disabled={soloLectura || actual.myScore == null}
                placeholder={actual.myScore == null ? "Primero poné un puntaje" : undefined}
                className={campo}
                onBlur={(e) => {
                  if (actual.myScore != null && e.target.value.trim() !== actual.myNote.trim()) void guardar(actual.myScore, e.target.value);
                }}
              />
            </label>
            <div className="flex justify-between text-[15px]">
              <button type="button" className={`${enlace} disabled:opacity-40`} aria-keyshortcuts="ArrowLeft" disabled={pos === 0} onClick={() => ir(-1)}>Anterior</button>
              <button type="button" className={`${enlace} disabled:opacity-40`} aria-keyshortcuts="ArrowRight" disabled={pos >= ids.length - 1} onClick={() => ir(1)}>Siguiente</button>
            </div>
            <p className="text-sm text-[var(--mf-muted)]">
              {soloLectura
                ? "La curaduría está cerrada: sólo lectura."
                : "Teclado: 1 a 5 puntúa, ← → pasan de obra, N escribe una nota y Escape sale de la nota."}
            </p>
            <p className="min-h-5 text-sm text-[var(--mf-muted)]" role="status" aria-live="polite">
              {guardando > 0 ? "Guardando…" : aviso}
            </p>
            {error ? <p role="alert" className="text-[var(--mf-alerta)]">{error}</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
