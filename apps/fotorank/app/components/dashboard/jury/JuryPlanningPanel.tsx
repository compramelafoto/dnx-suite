"use client";

import { useCallback, useEffect, useState } from "react";
import type { JuryCapacityResult } from "../../../lib/fotorank/jury/capacity-calculator";

type ApiResponse = JuryCapacityResult & {
  ok: boolean;
  confirmedEntries: number;
  usedFallbackEstimate: boolean;
  error?: { code: string; message: string };
};

const SEMAPHORE_LABEL: Record<JuryCapacityResult["semaphore"], string> = {
  green: "Capacidad OK",
  amber: "Capacidad ajustada",
  red: "Capacidad insuficiente",
};

const SEMAPHORE_CLASS: Record<JuryCapacityResult["semaphore"], string> = {
  green: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  amber: "border-amber-500/40 bg-amber-500/10 text-amber-200",
  red: "border-red-500/40 bg-red-500/10 text-red-300",
};

type Props = { contestId: string };

/**
 * Planificación de capacidad de jurado (ETAPA 16A). Puramente informativo:
 * nunca bloquea la publicación del concurso. Aproximación documentada en
 * `lib/fotorank/jury/capacity-calculator.ts`.
 */
export function JuryPlanningPanel({ contestId }: Props) {
  const [estimatedParticipants, setEstimatedParticipants] = useState<string>("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (override?: string) => {
      setLoading(true);
      setError(null);
      try {
        const qs = override?.trim() ? `?estimatedParticipants=${encodeURIComponent(override.trim())}` : "";
        const res = await fetch(`/api/fotorank/contests/${contestId}/jury/capacity${qs}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse;
        if (!res.ok || json.ok === false) {
          setError(json.error?.message ?? "No se pudo calcular la capacidad.");
          return;
        }
        setData(json);
      } catch {
        setError("Error de red al calcular capacidad.");
      } finally {
        setLoading(false);
      }
    },
    [contestId],
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial única
  }, [contestId]);

  return (
    <section
      className="fr-recuadro space-y-6 border border-fr-border bg-fr-card"
      data-testid="jury-planning-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-fr-primary">Planificación de jurado</h2>
        <p className="mt-2 text-sm text-fr-muted">
          Estimación informativa de cuántos jurados hacen falta. No bloquea la publicación del
          concurso ni ninguna acción operativa.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm" htmlFor="jury-planning-estimate">
          <span className="font-semibold text-fr-primary">Participantes estimados</span>
          <input
            id="jury-planning-estimate"
            type="number"
            min={0}
            className="fr-filter-input mt-2 w-40"
            placeholder={data ? String(data.confirmedEntries) : "—"}
            value={estimatedParticipants}
            onChange={(e) => setEstimatedParticipants(e.target.value)}
            data-testid="jury-planning-input"
          />
        </label>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
          disabled={loading}
          onClick={() => void load(estimatedParticipants)}
          data-testid="jury-planning-recalculate"
        >
          Recalcular
        </button>
        {data?.usedFallbackEstimate ? (
          <span className="text-xs text-fr-muted">
            Usando obras confirmadas actuales ({data.confirmedEntries}) como base.
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {data ? (
        <>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${SEMAPHORE_CLASS[data.semaphore]}`}
            data-testid="jury-planning-semaphore"
          >
            {SEMAPHORE_LABEL[data.semaphore]}
          </span>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-fr-muted">Obras estimadas</dt>
              <dd className="mt-2 text-xl font-semibold text-fr-primary">{data.estimatedEntries}</dd>
            </div>
            <div>
              <dt className="text-fr-muted">Evaluaciones estimadas</dt>
              <dd className="mt-2 text-xl font-semibold text-fr-primary">{data.totalAssignmentUnits}</dd>
              <dd className="text-xs text-fr-muted">
                mínimo {data.requiredEvaluationsPerEntry} por obra
              </dd>
            </div>
            <div>
              <dt className="text-fr-muted">Jurados recomendados</dt>
              <dd className="mt-2 text-xl font-semibold text-fr-primary">{data.recommendedJudges}</dd>
            </div>
            <div>
              <dt className="text-fr-muted">Jurados aceptados</dt>
              <dd className="mt-2 text-xl font-semibold text-fr-primary">{data.acceptedJudges}</dd>
            </div>
            <div>
              <dt className="text-fr-muted">Déficit</dt>
              <dd
                className={`mt-2 text-xl font-semibold ${data.deficit > 0 ? "text-amber-300" : "text-emerald-300"}`}
              >
                {data.deficit}
              </dd>
            </div>
            <div>
              <dt className="text-fr-muted">Carga por jurado</dt>
              <dd className="mt-2 text-xl font-semibold text-fr-primary">
                {data.loadPerJudge != null ? `${data.loadPerJudge.toFixed(1)} obras` : "—"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-fr-muted">
            {data.explanation ??
              `Carga recomendada por jurado: ${data.recommendedMaxEntriesPerJudge} obras · semáforo amarillo >${data.yellowLoadThreshold} · rojo >${data.redLoadThreshold}.`}
          </p>
        </>
      ) : loading ? (
        <p className="text-sm text-fr-muted">Calculando…</p>
      ) : null}
    </section>
  );
}
