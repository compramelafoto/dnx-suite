"use client";

import { useCallback, useEffect, useState } from "react";

type ProvisionalRankingApi = {
  ok: boolean;
  hasSession: boolean;
  scoringSessionId?: string;
  sessionStatus?: string;
  banner?: string | null;
  overallCoveragePercent?: number;
  overallComplete?: boolean;
  error?: { code: string; message: string };
};

type FinalistPromptResult = {
  scopeKey?: string;
  promptExternalId: string;
  promptSequence: number | null;
  promptTitle?: string | null;
  eligibleCandidates?: number;
  eligibleCandidateCount?: number;
  selected?: number;
  requested?: number;
  incomplete?: boolean;
  tieAtCutoff?: boolean;
  tieBreakRequired?: boolean;
};

type CalculateResult = {
  totalFinalists?: number;
  createdCount?: number;
  updatedCount?: number;
  skippedConfirmedCount?: number;
  promptResults?: FinalistPromptResult[];
  prompts?: FinalistPromptResult[];
  tieBreakRequiredPromptIds?: string[];
};

type PackageApi = {
  ok: boolean;
  hasSession: boolean;
  scoringSessionId?: string;
  packageStatus: string | null;
  positionsCount: number;
};

type ReadinessCheck = { pass: boolean; detail?: Record<string, unknown> };
type ReadinessApi = {
  ok: boolean;
  readiness?: {
    status: string;
    reasons: Array<{ code: string; message: string }>;
    checks: Record<string, ReadinessCheck>;
  };
  error?: { code: string; message: string };
};

type Props = { contestId: string };

const SESSIONS_OPEN_CLOSABLE = new Set(["OPEN"]);
const SESSIONS_CLOSED = new Set(["CLOSED", "LOCKED"]);

/**
 * ETAPA 16B — Cierre de jurado y cálculo de finalistas (pasos, no un botón único).
 * "FINALISTA ≠ ganador definitivo": el motor solo selecciona finalistas por consigna;
 * NUNCA activa voto público ni comercial por sí solo.
 */
export function JuryCloseFinalistsPanel({ contestId }: Props) {
  const [ranking, setRanking] = useState<ProvisionalRankingApi | null>(null);
  const [pkg, setPkg] = useState<PackageApi | null>(null);
  const [readiness, setReadiness] = useState<ReadinessApi["readiness"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [calcResult, setCalcResult] = useState<CalculateResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rankingRes, readinessRes] = await Promise.all([
        fetch(`/api/fotorank/contests/${contestId}/jury/provisional-ranking`, { cache: "no-store" }),
        fetch(`/api/fotorank/contests/${contestId}/jury/readiness/pre-public-vote`, { cache: "no-store" }),
      ]);
      const rankingJson = (await rankingRes.json()) as ProvisionalRankingApi;
      setRanking(rankingJson);

      const readinessJson = (await readinessRes.json()) as ReadinessApi;
      setReadiness(readinessJson.readiness ?? null);

      if (rankingJson.hasSession && rankingJson.sessionStatus && SESSIONS_CLOSED.has(rankingJson.sessionStatus)) {
        const pkgRes = await fetch(
          `/api/fotorank/contests/${contestId}/jury/finalists/package?scoringSessionId=${rankingJson.scoringSessionId}`,
          { cache: "no-store" },
        );
        const pkgJson = (await pkgRes.json()) as PackageApi;
        setPkg(pkgJson);
      } else {
        setPkg(null);
      }
    } catch {
      setError("Error de red al cargar el estado de jurado.");
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = useCallback(
    async (key: string, run: () => Promise<{ ok: boolean; message: string }>) => {
      setBusy(key);
      setActionMessage(null);
      try {
        const result = await run();
        setActionMessage(result.message);
      } catch {
        setActionMessage("Error de red al ejecutar la acción.");
      } finally {
        setBusy(null);
        void load();
      }
    },
    [load],
  );

  const closeJury = () =>
    runAction("close", async () => {
      const res = await fetch(`/api/fotorank/contests/${contestId}/jury/session/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      if (!res.ok || !json.ok) {
        return { ok: false, message: json.error?.message ?? "No se pudo cerrar el jurado." };
      }
      return { ok: true, message: "Jurado cerrado correctamente." };
    });

  const calculateFinalists = () =>
    runAction("calculate", async () => {
      const res = await fetch(`/api/fotorank/contests/${contestId}/jury/finalists/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as { ok: boolean; result?: CalculateResult; error?: { message: string } };
      if (!res.ok || !json.ok) {
        return { ok: false, message: json.error?.message ?? "No se pudo calcular finalistas." };
      }
      setCalcResult(json.result ?? null);
      const total = json.result?.totalFinalists ?? 0;
      const tieCount = json.result?.tieBreakRequiredPromptIds?.length ?? 0;
      return {
        ok: true,
        message:
          tieCount > 0
            ? `Calculado: ${total} finalistas. ${tieCount} consigna(s) requieren desempate con jurado extra.`
            : `Calculado: ${total} finalistas.`,
      };
    });

  const prepareAssets = () =>
    runAction("prepare", async () => {
      const res = await fetch(`/api/fotorank/contests/${contestId}/jury/finalists/prepare-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = (await res.json()) as {
        ok: boolean;
        result?: { preparedCount: number };
        error?: { message: string };
      };
      if (!res.ok || !json.ok) {
        return { ok: false, message: json.error?.message ?? "No se pudo preparar los assets sociales." };
      }
      return {
        ok: true,
        message: `Assets preparados (placeholder): ${json.result?.preparedCount ?? 0}. No se publicó nada.`,
      };
    });

  const sessionStatus = ranking?.sessionStatus ?? null;
  const canClose = ranking?.hasSession && sessionStatus ? SESSIONS_OPEN_CLOSABLE.has(sessionStatus) : false;
  const canCalculate = ranking?.hasSession && sessionStatus ? SESSIONS_CLOSED.has(sessionStatus) : false;
  const canReview = canCalculate && Boolean(pkg && pkg.positionsCount > 0);
  const canPrepare = canReview;

  const promptResults = calcResult?.promptResults ?? calcResult?.prompts ?? [];

  return (
    <section className="fr-recuadro space-y-8 border border-fr-border bg-fr-card" data-testid="jury-close-finalists-panel">
      <div>
        <h2 className="text-lg font-semibold text-fr-primary">Cierre de jurado y finalistas</h2>
        <p className="mt-2 text-sm text-fr-muted">
          Flujo en pasos (§8 master rules): finalista ≠ ganador definitivo. El público decide 1º/2º/3º
          más adelante — esto NUNCA activa voto público ni jurado comercial.
        </p>
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {/* Paso 1 — resumen */}
      <div
        className="rounded-xl border border-fr-border bg-fr-bg/40 px-4 py-4 text-sm space-y-2"
        data-testid="jury-close-finalists-summary"
      >
        <p className="font-semibold text-fr-primary">1. Resumen de cobertura / desempates / conflictos</p>
        {loading ? (
          <p className="text-fr-muted">Cargando…</p>
        ) : !ranking?.hasSession ? (
          <p className="text-fr-muted">Sin sesión de jurado todavía.</p>
        ) : (
          <>
            <p className="text-fr-muted">
              Estado de sesión: <span className="text-fr-primary">{sessionStatus}</span> · Cobertura:{" "}
              <span className="text-fr-primary">{ranking.overallCoveragePercent}%</span>
              {ranking.banner ? <span className="ml-2 text-amber-300">({ranking.banner})</span> : null}
            </p>
            {pkg ? (
              <p className="text-fr-muted">
                Paquete de finalistas: <span className="text-fr-primary">{pkg.packageStatus ?? "sin calcular"}</span>{" "}
                · Posiciones: <span className="text-fr-primary">{pkg.positionsCount}</span>
              </p>
            ) : null}
            {calcResult && promptResults.some((p) => p.tieAtCutoff || p.tieBreakRequired) ? (
              <p className="text-amber-300">
                Hay consignas con desempate pendiente (se solicitó jurado extra automáticamente).
              </p>
            ) : null}
            {readiness && readiness.status === "BLOCKED" ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-fr-muted">
                {readiness.reasons.slice(0, 6).map((r) => (
                  <li key={r.code}>{r.message}</li>
                ))}
              </ul>
            ) : readiness ? (
              <p className="text-emerald-300 text-xs">Listo para preparar voto público (READY_FOR_PUBLIC_VOTE).</p>
            ) : null}
          </>
        )}
      </div>

      {actionMessage ? (
        <p className="text-sm text-fr-primary" role="status" data-testid="jury-close-finalists-action-message">
          {actionMessage}
        </p>
      ) : null}

      {/* Pasos 2–5 */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
          disabled={!canClose || busy !== null}
          onClick={() => {
            if (!confirm("¿Cerrar el jurado? Esto bloquea nuevas evaluaciones.")) return;
            void closeJury();
          }}
          data-testid="jury-close-finalists-close"
        >
          {busy === "close" ? "Cerrando…" : "2. Cerrar jurado"}
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
          disabled={!canCalculate || busy !== null}
          onClick={() => void calculateFinalists()}
          data-testid="jury-close-finalists-calculate"
        >
          {busy === "calculate" ? "Calculando…" : "3. Calcular finalistas"}
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary min-h-11 px-5 text-sm"
          disabled={!canReview}
          onClick={() => setShowReview((v) => !v)}
          data-testid="jury-close-finalists-review"
        >
          {showReview ? "Ocultar revisión" : "4. Revisar finalistas"}
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-5 text-sm"
          disabled={!canPrepare || busy !== null}
          onClick={() => void prepareAssets()}
          data-testid="jury-close-finalists-prepare"
        >
          {busy === "prepare" ? "Preparando…" : "5. Preparar votación pública"}
        </button>
      </div>

      {showReview && promptResults.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-fr-border" data-testid="jury-close-finalists-prompts">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-fr-border text-fr-muted">
              <tr>
                <th className="px-3 py-3">Consigna</th>
                <th className="px-3 py-3">Candidatos</th>
                <th className="px-3 py-3">Seleccionados</th>
                <th className="px-3 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {promptResults.map((p) => (
                <tr key={p.promptExternalId} className="border-b border-fr-border/50">
                  <td className="px-3 py-3">
                    {p.promptTitle ?? p.promptExternalId}
                    {p.promptSequence != null ? ` (C${String(p.promptSequence).padStart(2, "0")})` : ""}
                  </td>
                  <td className="px-3 py-3">{p.eligibleCandidates ?? p.eligibleCandidateCount ?? "—"}</td>
                  <td className="px-3 py-3">
                    {p.selected ?? "—"}/{p.requested ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {p.tieAtCutoff || p.tieBreakRequired ? (
                      <span className="text-amber-300">Desempate pendiente</span>
                    ) : p.incomplete ? (
                      <span className="text-amber-300">Incompleto</span>
                    ) : (
                      <span className="text-emerald-300">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="text-xs text-fr-muted">
        Ver el detalle visual (imagen, código público, score de jurado) en el panel de preparación de
        voto público más abajo.
      </p>
    </section>
  );
}
