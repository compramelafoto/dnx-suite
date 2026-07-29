"use client";

import { useEffect, useRef, useState, useTransition } from "react";

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
};

export function JuryEvaluationForm({
  contestId,
  snapshotId,
  rubric,
  initialScores,
  initialComment,
  expectedVersion,
  status,
  scoringSessionOpen,
}: Props) {
  const [scores, setScores] = useState<Record<string, number>>({ ...initialScores });
  const [comment, setComment] = useState(initialComment ?? "");
  const [version, setVersion] = useState(expectedVersion);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const locked = status === "SUBMITTED" || status === "LOCKED" || !scoringSessionOpen;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = async (submit: boolean) => {
    setMessage(submit ? "Enviando…" : "Guardando…");
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
      error?: string;
      message?: string;
    };
    if (!res.ok) {
      setMessage(json.message ?? json.error ?? "No se pudo guardar");
      return;
    }
    if (typeof json.expectedVersion === "number") setVersion(json.expectedVersion);
    setMessage(
      submit
        ? `Enviado. Total (backend): ${json.totalScore ?? "—"}`
        : `Borrador guardado (v${json.expectedVersion})`,
    );
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

  return (
    <section className="fr-recuadro space-y-6 border border-fr-border bg-fr-card">
      <div>
        <h2 className="text-lg font-semibold text-fr-primary">Rúbrica · {rubric.name}</h2>
        <p className="mt-2 text-sm text-fr-muted">
          Versión {rubric.version}. El total lo calcula el servidor. No se muestran promedios ni
          scores de otros jurados.
        </p>
      </div>

      {!scoringSessionOpen ? (
        <p className="text-sm text-amber-200/90">La sesión de evaluación no está abierta.</p>
      ) : null}

      <ul className="space-y-6">
        {rubric.criteria.map((c) => (
          <li key={c.key} className="space-y-2">
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
              className="fr-filter-input w-full max-w-xs"
            />
          </li>
        ))}
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
          onClick={() => startTransition(() => void persist(false))}
        >
          Guardar borrador
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-5 py-3"
          disabled={locked || pending}
          onClick={() => {
            if (!confirm("¿Enviar evaluación definitiva? No podrás editarla libremente.")) return;
            startTransition(() => void persist(true));
          }}
        >
          Enviar definitiva
        </button>
      </div>
      {message ? (
        <p className="text-sm text-fr-muted" role="status">
          {message}
        </p>
      ) : null}
      {locked && status ? (
        <p className="text-sm text-gold">Estado: {status}</p>
      ) : null}
    </section>
  );
}
