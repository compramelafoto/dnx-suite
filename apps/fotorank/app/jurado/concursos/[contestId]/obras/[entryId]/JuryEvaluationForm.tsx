"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Criterion = {
  key: string;
  name: string;
  description: string | null;
  minScore: number;
  maxScore: number;
  step: number;
  weight: number;
  required: boolean;
  helpText: string | null;
};

type Props = {
  contestId: string;
  entryId: string;
  snapshotId: string;
  rubric: {
    id: string;
    name: string;
    version: number;
    criteria: Criterion[];
  };
  initialScores: Record<string, number>;
  initialComment: string | null;
  expectedVersion: number;
  status: string | null;
  scoringSessionOpen: boolean;
  /** Habilita el overlay de zoom (Z). Sin esto, el atajo Z queda deshabilitado. */
  previewUrl?: string | null;
  /** Solo para alt text del zoom; nunca se usa para revelar identidad. */
  anonymousCode?: string;
  /** Progreso opcional "Obra X de Y" — el padre decide si lo pasa (sin datos inventados). */
  index?: number;
  total?: number;
  /** Siguiente/anterior obra en el orden anónimo estable (jury-order.ts). null si no hay. */
  nextEntryId?: string | null;
  prevEntryId?: string | null;
  /**
   * ETAPA 16B — avance automático tras envío definitivo con los 3 criterios completos.
   * Default false (sin sorpresas); la página puede habilitarlo explícitamente (UX Clickatón).
   */
  autoAdvanceOnComplete?: boolean;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  return el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT";
}

export function JuryEvaluationForm({
  contestId,
  entryId,
  snapshotId,
  rubric,
  initialScores,
  initialComment,
  expectedVersion,
  status,
  scoringSessionOpen,
  previewUrl,
  anonymousCode,
  index,
  total,
  nextEntryId = null,
  prevEntryId = null,
  autoAdvanceOnComplete = false,
}: Props) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, number>>({ ...initialScores });
  const [comment, setComment] = useState(initialComment ?? "");
  const [version, setVersion] = useState(expectedVersion);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const locked = status === "SUBMITTED" || status === "LOCKED" || !scoringSessionOpen;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = () => {
    if (nextEntryId) {
      router.push(`/jurado/concursos/${contestId}/obras/${nextEntryId}`);
    } else {
      setMessage("No hay una obra siguiente configurada todavía.");
    }
  };
  const goPrev = () => {
    if (prevEntryId) {
      router.push(`/jurado/concursos/${contestId}/obras/${prevEntryId}`);
    } else {
      setMessage("No hay una obra anterior.");
    }
  };

  const persist = async (submit: boolean) => {
    if (!submit) setSaveState("saving");
    else setMessage("Enviando…");
    try {
      const res = await fetch(`/api/fotorank/jury/contests/${contestId}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotId,
          scores: Object.entries(scores).map(([key, score]) => ({ key, score })),
          privateComment: comment,
          submit,
          expectedVersion: version,
          idempotencyKey: submit ? crypto.randomUUID() : undefined,
        }),
      });
      const json = (await res.json()) as {
        expectedVersion?: number;
        status?: string;
        totalScore?: number;
        error?: { message?: string };
        message?: string;
      };
      if (!res.ok) {
        if (!submit) setSaveState("error");
        setMessage(json.message ?? json.error?.message ?? "No se pudo guardar");
        return;
      }
      if (typeof json.expectedVersion === "number") setVersion(json.expectedVersion);
      if (!submit) {
        setSaveState("saved");
      } else {
        setMessage(`Enviado. Total (backend): ${json.totalScore ?? "—"}`);
        if (autoAdvanceOnComplete && nextEntryId) {
          setTimeout(() => goNext(), 900);
        }
      }
    } catch {
      if (!submit) setSaveState("error");
      setMessage("Error de red — reintentá");
    }
  };

  useEffect(() => {
    if (locked) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(() => {
        void persist(false);
      });
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- autosave on scores/comment
  }, [scores, comment, locked]);

  const setScoreForActive = (n: number) => {
    const criterion = rubric.criteria[activeIndex];
    if (!criterion) return;
    const clamped = Math.min(criterion.maxScore, Math.max(criterion.minScore, n));
    setScores((prev) => ({ ...prev, [criterion.key]: clamped }));
  };

  const handlePostpone = () => {
    startTransition(async () => {
      setMessage("Posponiendo…");
      const res = await fetch(`/api/fotorank/jury/contests/${contestId}/evaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId, postpone: true, expectedVersion: version }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        expectedVersion?: number;
        error?: { message?: string };
        message?: string;
      };
      if (!res.ok) {
        setMessage(json.message ?? json.error?.message ?? "No se pudo posponer.");
        return;
      }
      if (typeof json.expectedVersion === "number") setVersion(json.expectedVersion);
      setMessage("Obra marcada para revisar después.");
      goNext();
    });
  };

  const handleQuickConflict = () => {
    if (
      !window.confirm(
        "¿Confirmás que tenés un conflicto de interés con esta obra? Ya no se te va a asignar.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      setMessage("Registrando conflicto…");
      const res = await fetch(
        `/api/fotorank/jury/contests/${contestId}/entries/${entryId}/conflict`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reasonCode: "OTHER" }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: { message?: string };
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setMessage(data.error?.message ?? data.message ?? "No se pudo declarar el conflicto.");
        return;
      }
      setMessage("Conflicto registrado. Esta obra ya no se te asigna.");
      goNext();
    });
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(document.activeElement)) {
        if (e.key === "Escape" && zoomOpen) {
          setZoomOpen(false);
        }
        return;
      }
      if (e.key === "Escape") {
        if (zoomOpen) {
          e.preventDefault();
          setZoomOpen(false);
        }
        return;
      }
      if (locked) return;

      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        setScoreForActive(Number(e.key));
        return;
      }
      if (e.key === "0") {
        e.preventDefault();
        setScoreForActive(10);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        const delta = e.shiftKey ? -1 : 1;
        setActiveIndex((i) => (i + delta + rubric.criteria.length) % rubric.criteria.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + rubric.criteria.length) % rubric.criteria.length);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % rubric.criteria.length);
        return;
      }
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePostpone();
        return;
      }
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (previewUrl) setZoomOpen((v) => !v);
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers cierran sobre estado vía refs/setters funcionales
  }, [locked, zoomOpen, previewUrl, rubric.criteria.length, nextEntryId, prevEntryId]);

  return (
    <section className="fr-recuadro space-y-6 border border-fr-border bg-fr-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-fr-primary">Rúbrica · {rubric.name}</h2>
          <p className="mt-2 text-sm text-fr-muted">
            Versión {rubric.version}. El total lo calcula el servidor. No se muestran promedios ni
            scores de otros jurados.
          </p>
        </div>
        {typeof index === "number" && typeof total === "number" ? (
          <p className="text-sm font-semibold text-gold" data-testid="jury-eval-progress">
            Obra {index} de {total}
          </p>
        ) : null}
      </div>

      <details className="rounded-xl border border-fr-border/60 bg-fr-bg/40 px-4 py-3 text-xs text-fr-muted" open>
        <summary className="cursor-pointer text-sm font-semibold text-fr-primary">
          Atajos de teclado
        </summary>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          <li>
            <span className="text-gold">1–9, 0</span> puntaje del criterio activo (0 = 10)
          </li>
          <li>
            <span className="text-gold">Tab / Shift+Tab</span> o <span className="text-gold">↑/↓</span> mover
            criterio
          </li>
          <li>
            <span className="text-gold">N</span> o <span className="text-gold">→</span> siguiente obra ·{" "}
            <span className="text-gold">←</span> obra anterior
          </li>
          <li>
            <span className="text-gold">P</span> revisar después (posponer)
          </li>
          <li>
            <span className="text-gold">Z</span> zoom de la foto · <span className="text-gold">Esc</span> cerrar
          </li>
        </ul>
        <p className="mt-3">Los atajos no funcionan mientras escribís en el comentario.</p>
      </details>

      {!scoringSessionOpen ? (
        <p className="text-sm text-amber-200/90">La sesión de evaluación no está abierta.</p>
      ) : null}

      <ul className="space-y-4">
        {rubric.criteria.map((c, idx) => {
          const isActive = idx === activeIndex;
          const range = c.maxScore - c.minScore;
          const useButtons = c.step === 1 && range >= 0 && range <= 9 && c.minScore >= 0;
          const options = useButtons
            ? Array.from({ length: range + 1 }, (_, i) => c.minScore + i)
            : [];
          return (
            <li
              key={c.key}
              className={`space-y-3 rounded-xl border p-4 transition-colors ${
                isActive ? "border-gold bg-fr-bg/50 ring-1 ring-gold/40" : "border-fr-border/60"
              }`}
              onClick={() => setActiveIndex(idx)}
              data-testid={`jury-eval-criterion-${c.key}`}
              data-active={isActive}
            >
              <label className="block text-sm font-semibold text-fr-primary" htmlFor={`c-${c.key}`}>
                {c.name}
                {c.required ? " *" : ""}{" "}
                <span className="font-normal text-fr-muted">
                  ({c.minScore}–{c.maxScore}, peso {c.weight})
                </span>
              </label>
              {c.helpText || c.description ? (
                <p className="text-xs text-fr-muted">{c.helpText ?? c.description}</p>
              ) : null}
              {useButtons ? (
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={`Puntaje para ${c.name}`}
                >
                  {options.map((n) => (
                    <button
                      key={n}
                      type="button"
                      disabled={locked || pending}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveIndex(idx);
                        setScores((prev) => ({ ...prev, [c.key]: n }));
                      }}
                      className={`flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold transition-colors disabled:opacity-50 ${
                        scores[c.key] === n
                          ? "border-gold bg-gold text-fr-bg"
                          : "border-fr-border text-fr-primary hover:border-gold/60"
                      }`}
                      data-testid={`jury-eval-score-${c.key}-${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  id={`c-${c.key}`}
                  type="number"
                  min={c.minScore}
                  max={c.maxScore}
                  step={c.step}
                  disabled={locked || pending}
                  value={scores[c.key] ?? ""}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setScores((prev) => ({ ...prev, [c.key]: n }));
                  }}
                  onFocus={() => setActiveIndex(idx)}
                  className="fr-filter-input w-full max-w-xs"
                />
              )}
            </li>
          );
        })}
      </ul>

      <label className="block space-y-2 text-sm" htmlFor="private-comment">
        <span className="font-semibold text-fr-primary">Comentario privado</span>
        <textarea
          id="private-comment"
          disabled={locked || pending}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          className="w-full rounded border border-fr-border bg-fr-bg px-3 py-2 text-fr-primary"
        />
      </label>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
          disabled={locked || pending}
          data-testid="jury-eval-draft"
          onClick={() => startTransition(() => void persist(false))}
        >
          Guardar borrador
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-5 py-3"
          disabled={locked || pending}
          data-testid="jury-eval-submit"
          onClick={() => {
            if (!confirm("¿Enviar evaluación definitiva? No podrás editarla libremente.")) return;
            startTransition(() => void persist(true));
          }}
        >
          Enviar definitiva
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
          disabled={locked || pending}
          data-testid="jury-eval-postpone"
          onClick={handlePostpone}
        >
          Revisar después
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
          disabled={locked || pending}
          data-testid="jury-eval-abstain"
          onClick={() => {
            const reason = window.prompt("Motivo de abstención (obligatorio):");
            if (!reason?.trim()) return;
            startTransition(async () => {
              setMessage("Registrando abstención…");
              const res = await fetch(
                `/api/fotorank/jury/contests/${contestId}/entries/${entryId}/abstain`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    snapshotId,
                    reason,
                    reasonCode: "OTHER",
                  }),
                },
              );
              if (!res.ok) {
                const json = (await res.json()) as { error?: { message?: string } };
                setMessage(json.error?.message ?? "No se pudo abstener");
                return;
              }
              setMessage("Abstención registrada (no cuenta como score).");
            });
          }}
        >
          Abstenerse
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
          disabled={pending}
          data-testid="jury-eval-conflict-quick"
          onClick={handleQuickConflict}
        >
          Tengo un conflicto de interés
        </button>
        {previewUrl ? (
          <button
            type="button"
            className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
            onClick={() => setZoomOpen(true)}
            data-testid="jury-eval-zoom-open"
          >
            Zoom (Z)
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-fr-border/60 pt-6">
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 py-3"
          disabled={!prevEntryId}
          onClick={goPrev}
          data-testid="jury-eval-prev"
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-5 py-3"
          disabled={!nextEntryId}
          onClick={goNext}
          data-testid="jury-eval-next"
        >
          Siguiente →
        </button>
        {autoAdvanceOnComplete ? (
          <span className="flex items-center text-xs text-fr-muted">
            Avance automático activado tras enviar definitiva.
          </span>
        ) : null}
      </div>

      {saveState !== "idle" ? (
        <p
          className={`text-sm ${saveState === "error" ? "text-red-300" : "text-fr-muted"}`}
          role="status"
          data-testid="jury-eval-save-status"
        >
          {saveState === "saving" ? "Guardando…" : null}
          {saveState === "saved" ? "Guardado" : null}
          {saveState === "error" ? (
            <>
              Error —{" "}
              <button
                type="button"
                className="text-gold underline"
                onClick={() => startTransition(() => void persist(false))}
              >
                reintentar
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      {message ? (
        <p className="text-sm text-fr-muted" role="status">
          {message}
        </p>
      ) : null}
      {locked && status ? (
        <p className="text-sm text-gold">Estado: {status}</p>
      ) : null}

      {zoomOpen && previewUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Zoom de la obra"
          onClick={() => setZoomOpen(false)}
          data-testid="jury-eval-zoom-overlay"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={anonymousCode ? `Vista ampliada ${anonymousCode}` : "Vista ampliada"}
            className="max-h-[95vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            className="fr-btn fr-btn-secondary absolute right-4 top-4 min-h-11 px-4"
            onClick={() => setZoomOpen(false)}
          >
            Cerrar (Esc)
          </button>
        </div>
      ) : null}
    </section>
  );
}
