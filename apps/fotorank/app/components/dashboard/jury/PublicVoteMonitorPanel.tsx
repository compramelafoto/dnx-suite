"use client";

import { useCallback, useEffect, useState } from "react";

type UnitRow = {
  roundId: string;
  unitKey: string;
  roundNumber: number;
  roundType: string;
  status: string;
  provider: string;
  providerHealth: string;
  stale: boolean;
  startsAt: string;
  endsAt: string;
  timer: { phase: string; msRemaining: number | null; label: string };
  candidates: Array<{
    publicCode: string;
    currentMetric: number;
    final: { finalMetricValue: number; finalPosition: number | null } | null;
  }>;
  lastSyncAt: string | null;
  resultsPublicationStatus: string;
};

type MonitorApi = {
  ok: boolean;
  monitor?: {
    summary: {
      totalRounds: number;
      open: number;
      closed: number;
      error: number;
      ties: number;
      pendingVerification: number;
      totalLikesObserved: number;
      lastSyncAt: string | null;
      phaseFinalized: boolean;
      resultsPublication: string;
      published: boolean;
    };
    units: UnitRow[];
  };
  error?: { code: string; message: string };
};

type Props = { contestId: string };

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  READY: "Lista",
  SCHEDULED: "Programada",
  OPEN: "Abierta",
  CLOSING: "Cerrando",
  PENDING_FINAL_SNAPSHOT: "Esperando verificación",
  CLOSED: "Cerrada",
  TIEBREAK_REQUIRED: "Desempate requerido",
  FINALIZED: "Finalizada",
  CANCELLED: "Cancelada",
  ERROR: "Error",
};

function formatRemaining(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

/**
 * ETAPA 17A — Monitor de votación pública (organizador).
 * Métricas operativas mientras OPEN; ranking/posiciones solo tras snapshot final.
 * Nunca publica resultados comerciales.
 */
export function PublicVoteMonitorPanel({ contestId }: Props) {
  const [data, setData] = useState<MonitorApi["monitor"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [simCode, setSimCode] = useState("");
  const [simValue, setSimValue] = useState("100");
  const [simRoundId, setSimRoundId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fotorank/contests/${contestId}/public-vote/monitor`, {
        cache: "no-store",
      });
      const json = (await res.json()) as MonitorApi;
      if (!json.ok || !json.monitor) {
        setError(json.error?.message ?? "No se pudo cargar el monitor.");
        setData(null);
        return;
      }
      setData(json.monitor);
      if (!simRoundId && json.monitor.units[0]) {
        setSimRoundId(json.monitor.units[0].roundId);
        setSimCode(json.monitor.units[0].candidates[0]?.publicCode ?? "");
      }
    } catch {
      setError("Error de red al cargar votación pública.");
    } finally {
      setLoading(false);
    }
  }, [contestId, simRoundId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 15_000);
    return () => clearInterval(t);
  }, [load]);

  async function createRounds() {
    setBusy(true);
    try {
      const res = await fetch(`/api/fotorank/contests/${contestId}/public-vote/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.ok) setError(json.error?.message ?? "No se pudieron crear rondas.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function runAction(roundId: string, action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/fotorank/contests/${contestId}/public-vote/rounds/${roundId}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );
      const json = await res.json();
      if (!json.ok) setError(json.error?.message ?? "Acción fallida.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    if (!simRoundId || !simCode) return;
    await runAction(simRoundId, "simulate_metrics", {
      metrics: { [simCode]: Number(simValue) || 0 },
    });
  }

  if (loading && !data) {
    return (
      <section className="fr-recuadro space-y-4">
        <h2 className="text-xl font-semibold tracking-tight text-fr-primary">Votación pública</h2>
        <p className="fr-body-small text-fr-muted">Cargando monitor…</p>
      </section>
    );
  }

  const summary = data?.summary;

  return (
    <section className="fr-recuadro space-y-8">
      <header className="space-y-4">
        <p className="fr-eyebrow">Votación pública</p>
        <h2 className="text-xl font-semibold tracking-tight text-fr-primary md:text-2xl">
          Monitor por consigna
        </h2>
        <p className="fr-page-description max-w-2xl">
          El jurado selecciona. El público decide. Las posiciones definitivas solo aparecen tras el
          cierre y el snapshot final. Los resultados no se publican automáticamente.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-6 py-4 text-sm text-fr-primary">
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-fr-border bg-fr-card p-6">
            <p className="text-xs uppercase tracking-wide text-fr-muted">Rondas</p>
            <p className="mt-4 text-2xl font-semibold text-fr-primary">{summary.totalRounds}</p>
          </div>
          <div className="rounded-xl border border-fr-border bg-fr-card p-6">
            <p className="text-xs uppercase tracking-wide text-fr-muted">Abiertas</p>
            <p className="mt-4 text-2xl font-semibold text-gold">{summary.open}</p>
          </div>
          <div className="rounded-xl border border-fr-border bg-fr-card p-6">
            <p className="text-xs uppercase tracking-wide text-fr-muted">Empates / pendientes</p>
            <p className="mt-4 text-2xl font-semibold text-fr-primary">
              {summary.ties} / {summary.pendingVerification}
            </p>
          </div>
          <div className="rounded-xl border border-fr-border bg-fr-card p-6">
            <p className="text-xs uppercase tracking-wide text-fr-muted">Publicación</p>
            <p className="mt-4 text-sm font-semibold text-fr-primary">
              {summary.published ? "Publicado" : "Calculado (no publicado)"}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-primary"
          disabled={busy}
          onClick={() => void createRounds()}
        >
          Crear rondas desde finalistas
        </button>
        <button
          type="button"
          className="fr-btn fr-btn-secondary"
          disabled={busy || !data?.units[0]}
          onClick={() => data?.units[0] && void runAction(data.units[0].roundId, "worker_pass")}
        >
          Pasada de workers
        </button>
      </div>

      {/* Simulador TEST — claramente marcado */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 space-y-6">
        <h3 className="text-base font-semibold text-fr-primary">Simulador TEST</h3>
        <p className="fr-body-small text-fr-muted">
          Solo TEST_PROVIDER. No afecta Instagram ni ediciones comerciales.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          <label className="fr-field-stack">
            <span className="text-sm font-semibold text-fr-primary">Ronda</span>
            <select
              className="fr-filter-select w-full"
              value={simRoundId}
              onChange={(e) => setSimRoundId(e.target.value)}
            >
              {(data?.units ?? []).map((u) => (
                <option key={u.roundId} value={u.roundId}>
                  {u.unitKey} · r{u.roundNumber} · {STATUS_LABEL[u.status] ?? u.status}
                </option>
              ))}
            </select>
          </label>
          <label className="fr-field-stack">
            <span className="text-sm font-semibold text-fr-primary">Código</span>
            <input
              className="fr-filter-input w-full"
              value={simCode}
              onChange={(e) => setSimCode(e.target.value)}
              placeholder="C01-F01"
            />
          </label>
          <label className="fr-field-stack">
            <span className="text-sm font-semibold text-fr-primary">Likes</span>
            <input
              className="fr-filter-input w-full"
              value={simValue}
              onChange={(e) => setSimValue(e.target.value)}
            />
          </label>
        </div>
        <button
          type="button"
          className="fr-btn fr-btn-secondary"
          disabled={busy}
          onClick={() => void simulate()}
        >
          Ingestar métrica de prueba
        </button>
      </div>

      <div className="space-y-8">
        {(data?.units ?? []).map((u) => (
          <article
            key={u.roundId}
            className="rounded-xl border border-fr-border bg-fr-card p-6 md:p-8 space-y-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-fr-primary">
                  Consigna {u.unitKey}
                  {u.roundType === "TIEBREAK" ? " · Desempate" : ""}
                </h3>
                <p className="text-sm text-fr-muted">
                  {STATUS_LABEL[u.status] ?? u.status} · {u.timer.label}{" "}
                  {u.timer.msRemaining != null ? formatRemaining(u.timer.msRemaining) : ""}
                </p>
                <p className="text-xs text-fr-muted">
                  Inicio {new Date(u.startsAt).toLocaleString()} · Cierre{" "}
                  {new Date(u.endsAt).toLocaleString()} · Provider {u.provider} · Salud{" "}
                  {u.providerHealth}
                  {u.stale ? " · Datos stale" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {["READY", "SCHEDULED"].includes(u.status) ? (
                  <button
                    type="button"
                    className="fr-btn fr-btn-secondary"
                    disabled={busy}
                    onClick={() => void runAction(u.roundId, "schedule")}
                  >
                    Programar
                  </button>
                ) : null}
                {["READY", "SCHEDULED"].includes(u.status) ? (
                  <button
                    type="button"
                    className="fr-btn fr-btn-primary"
                    disabled={busy}
                    onClick={() => void runAction(u.roundId, "open", { force: true })}
                  >
                    Abrir
                  </button>
                ) : null}
                {["OPEN", "CLOSING", "PENDING_FINAL_SNAPSHOT"].includes(u.status) ? (
                  <button
                    type="button"
                    className="fr-btn fr-btn-primary"
                    disabled={busy}
                    onClick={() => void runAction(u.roundId, "finalize")}
                  >
                    Cerrar / snapshot
                  </button>
                ) : null}
              </div>
            </div>

            <ul className="space-y-4">
              {u.candidates.map((c) => (
                <li
                  key={c.publicCode}
                  className="flex flex-wrap items-center justify-between gap-3 border-t border-fr-border pt-4"
                >
                  <span className="font-semibold text-fr-primary">{c.publicCode}</span>
                  <span className="text-sm text-fr-muted">
                    Actual: {c.currentMetric}
                    {c.final
                      ? ` · Final: ${c.final.finalMetricValue}${
                          c.final.finalPosition != null ? ` · ${c.final.finalPosition}.º` : " · empate"
                        }`
                      : u.status === "OPEN"
                        ? " · (sin ganador aún)"
                        : ""}
                  </span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>

      {!data?.units.length ? (
        <p className="fr-body-small text-fr-muted">
          Todavía no hay rondas de voto público. Confirmá finalistas y creá las rondas cuando el
          checklist esté listo.
        </p>
      ) : null}
    </section>
  );
}
