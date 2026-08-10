"use client";

import { useEffect, useState } from "react";

type ProvisionalRankingRow = {
  snapshotId: string;
  anonymousCode: string;
  categoryId: string;
  promptExternalId: string | null;
  evaluationCount: number;
  requiredEvaluations: number;
  coveragePercent: number;
  coverageComplete: boolean;
  averageScore: number | null;
  normalizedAverage: number | null;
};

type OrganizerProvisionalRanking = {
  scoringSessionId: string;
  sessionStatus: string;
  banner: string | null;
  overallCoveragePercent: number;
  overallComplete: boolean;
  rows: ProvisionalRankingRow[];
};

type ApiResponse = {
  ok: boolean;
  hasSession: boolean;
  error?: { code: string; message: string };
} & Partial<OrganizerProvisionalRanking>;

type Props = { contestId: string };

/**
 * Ranking provisorio del jurado, vista rápida para el organizador (ETAPA 16A — §7.8 master rules).
 * NO reemplaza el ranking privado oficial (Etapa 15 / `FotorankResultBatch`).
 * Siempre muestra el banner "RESULTADO PROVISORIO — EVALUACIÓN INCOMPLETA" mientras falte cobertura.
 */
export function JuryProvisionalRankingBanner({ contestId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/fotorank/contests/${contestId}/jury/provisional-ranking`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok || json.ok === false) {
          setError(json.error?.message ?? "No se pudo cargar el ranking provisorio.");
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setError("Error de red al cargar el ranking provisorio.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [contestId]);

  if (loading) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="jury-provisional-ranking">
        <p className="text-sm text-fr-muted">Cargando ranking provisorio…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="jury-provisional-ranking">
        <p className="text-sm text-red-300">{error}</p>
      </section>
    );
  }

  if (!data || !data.hasSession || !data.rows) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="jury-provisional-ranking">
        <p className="text-sm text-fr-muted">
          Sin sesión de jurado todavía — no hay ranking provisorio para mostrar.
        </p>
      </section>
    );
  }

  return (
    <section
      className="fr-recuadro space-y-6 border border-fr-border bg-fr-card"
      data-testid="jury-provisional-ranking"
    >
      <div
        className={`rounded-xl border px-4 py-4 text-sm ${
          data.overallComplete
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/40 bg-amber-500/10 text-amber-100"
        }`}
        data-testid="jury-provisional-ranking-banner"
      >
        <p className="font-semibold uppercase tracking-wide">
          {data.banner ?? "COBERTURA COMPLETA"}
        </p>
        <p className="mt-2">Cobertura: {data.overallCoveragePercent}% de las obras.</p>
        <p className="mt-2 text-xs">
          Vista de trabajo, no oficial. El ranking privado definitivo se genera desde el flujo de
          cierre de sesión (Etapa 15).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-fr-border text-fr-muted">
            <tr>
              <th className="px-3 py-3">#</th>
              <th className="px-3 py-3">Código anónimo</th>
              <th className="px-3 py-3">Evaluaciones</th>
              <th className="px-3 py-3">Promedio</th>
              <th className="px-3 py-3">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, index) => (
              <tr key={row.snapshotId} className="border-b border-fr-border/50">
                <td className="px-3 py-3">{index + 1}</td>
                <td className="px-3 py-3 text-gold">{row.anonymousCode}</td>
                <td className="px-3 py-3">
                  {row.evaluationCount}/{row.requiredEvaluations}
                </td>
                <td className="px-3 py-3">
                  {row.averageScore != null ? row.averageScore.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-3">
                  {row.coverageComplete ? (
                    <span className="text-emerald-300">completa ({row.coveragePercent}%)</span>
                  ) : (
                    <span className="text-amber-300">incompleta ({row.coveragePercent}%)</span>
                  )}
                </td>
              </tr>
            ))}
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-fr-muted">
                  Todavía no hay obras congeladas en esta sesión.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
