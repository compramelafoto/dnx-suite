"use client";

import { useCallback, useEffect, useState } from "react";

type FinalistReviewRow = {
  id: string;
  promptExternalId: string;
  promptSequence: number | null;
  promptTitle: string | null;
  publicCode: string;
  anonymousCode: string;
  internalJuryRank: number;
  aggregateScore: number | null;
  normalizedScore: number | null;
  derivativeStatus: string;
  status: string;
  previewUrl: string | null;
  confirmedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
};

type PackageApi = {
  ok: boolean;
  hasSession: boolean;
  scoringSessionId?: string;
  packageStatus: string | null;
  positionsCount: number;
  rows: FinalistReviewRow[];
  error?: { code: string; message: string };
};

type ReadinessApi = {
  ok: boolean;
  readiness?: {
    status: "READY_FOR_PUBLIC_VOTE" | "BLOCKED";
    reasons: Array<{ code: string; message: string }>;
  };
  error?: { code: string; message: string };
};

type Props = { contestId: string };

const DERIVATIVE_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  READY: "Listo",
  FAILED: "Falló",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmado",
  REVOKED: "Revocado",
};

function groupByPrompt(rows: FinalistReviewRow[]) {
  const map = new Map<string, FinalistReviewRow[]>();
  for (const row of rows) {
    const arr = map.get(row.promptExternalId) ?? [];
    arr.push(row);
    map.set(row.promptExternalId, arr);
  }
  return [...map.entries()].sort((a, b) => {
    const sa = a[1][0]?.promptSequence ?? 0;
    const sb = b[1][0]?.promptSequence ?? 0;
    return sa - sb;
  });
}

/**
 * ETAPA 16B — Preparación de voto público para el organizador (§8–§10 master rules).
 * Muestra los 3 finalistas por consigna (imagen, código público, score de jurado SOLO
 * organizador, estado de asset). Preview social es un placeholder — NUNCA publica ni
 * activa el voto público comercial/automatizado por sí solo.
 */
export function FinalistsPublicPrepPanel({ contestId }: Props) {
  const [pkg, setPkg] = useState<PackageApi | null>(null);
  const [readiness, setReadiness] = useState<ReadinessApi["readiness"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [socialPreviewRowId, setSocialPreviewRowId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pkgRes, readinessRes] = await Promise.all([
        fetch(`/api/fotorank/contests/${contestId}/jury/finalists/package`, { cache: "no-store" }),
        fetch(`/api/fotorank/contests/${contestId}/jury/readiness/pre-public-vote`, { cache: "no-store" }),
      ]);
      const pkgJson = (await pkgRes.json()) as PackageApi;
      setPkg(pkgJson);
      const readinessJson = (await readinessRes.json()) as ReadinessApi;
      setReadiness(readinessJson.readiness ?? null);
    } catch {
      setError("Error de red al cargar la preparación de voto público.");
    } finally {
      setLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmFinalists = useCallback(async () => {
    setBusy("confirm");
    setMessage(null);
    try {
      const res = await fetch(`/api/fotorank/contests/${contestId}/jury/finalists/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = (await res.json()) as { ok: boolean; error?: { message: string } };
      setMessage(
        res.ok && json.ok
          ? "Paquete de finalistas CONFIRMADO. Sigue sin activar el voto público."
          : json.error?.message ?? "No se pudo confirmar el paquete.",
      );
    } catch {
      setMessage("Error de red al confirmar.");
    } finally {
      setBusy(null);
      void load();
    }
  }, [contestId, load]);

  const revokeFinalist = useCallback(
    async (row: FinalistReviewRow) => {
      const reason = window.prompt(`Motivo para revocar a ${row.publicCode} (obligatorio):`);
      if (!reason?.trim()) return;
      setBusy(`revoke-${row.id}`);
      setMessage(null);
      try {
        const res = await fetch(`/api/fotorank/contests/${contestId}/jury/finalists/revoke`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId: row.id, reason }),
        });
        const json = (await res.json()) as { ok: boolean; error?: { message: string } };
        setMessage(
          res.ok && json.ok
            ? `${row.publicCode} revocado. Se promovió al siguiente candidato elegible si existía.`
            : json.error?.message ?? "No se pudo revocar el finalista.",
        );
      } catch {
        setMessage("Error de red al revocar.");
      } finally {
        setBusy(null);
        void load();
      }
    },
    [contestId, load],
  );

  if (loading) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="finalists-public-prep-panel">
        <p className="text-sm text-fr-muted">Cargando finalistas…</p>
      </section>
    );
  }

  if (error || !pkg?.ok) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="finalists-public-prep-panel">
        <p className="text-sm text-red-300">{error ?? pkg?.error?.message ?? "No se pudo cargar."}</p>
      </section>
    );
  }

  if (!pkg.hasSession || pkg.rows.length === 0) {
    return (
      <section className="fr-recuadro border border-fr-border bg-fr-card" data-testid="finalists-public-prep-panel">
        <p className="text-sm text-fr-muted">
          Todavía no hay finalistas calculados. Usá &ldquo;Calcular finalistas&rdquo; en el panel de
          cierre de jurado.
        </p>
      </section>
    );
  }

  const groups = groupByPrompt(pkg.rows);
  const isConfirmed = pkg.packageStatus === "CONFIRMED";
  const canConfirm = !isConfirmed && readiness?.status === "READY_FOR_PUBLIC_VOTE";

  return (
    <section
      className="fr-recuadro space-y-8 border border-fr-border bg-fr-card"
      data-testid="finalists-public-prep-panel"
    >
      <div>
        <h2 className="text-lg font-semibold text-fr-primary">Preparación de voto público</h2>
        <p className="mt-2 text-sm text-fr-muted">
          Solo preparación: NO abre ni activa el voto público. El score de jurado es visible acá
          únicamente para el organizador; nunca se publica.
        </p>
      </div>

      {!isConfirmed ? (
        <div
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-4 text-sm text-amber-100"
          data-testid="finalists-not-confirmed-banner"
        >
          Finalistas aún NO confirmados (estado: {pkg.packageStatus ?? "sin paquete"}). Este armado es
          preliminar y puede recalcularse.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-4 text-sm text-emerald-200">
          Finalistas CONFIRMADOS ({pkg.positionsCount} posiciones). Cambios puntuales solo vía revocación
          auditada.
        </div>
      )}

      {readiness && readiness.status === "BLOCKED" ? (
        <div className="rounded-xl border border-fr-border bg-fr-bg/40 px-4 py-4 text-sm" data-testid="pre-public-vote-blocked">
          <p className="font-semibold text-fr-primary">Bloqueado para READY_FOR_PUBLIC_VOTE:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-fr-muted">
            {readiness.reasons.map((r) => (
              <li key={r.code}>{r.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <p className="text-sm text-fr-primary" role="status" data-testid="finalists-public-prep-message">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className="fr-btn fr-btn-primary min-h-11 px-5 text-sm"
          disabled={!canConfirm || busy !== null}
          onClick={() => {
            if (!confirm("¿Confirmar el paquete de finalistas? Quedará inmutable salvo revocación puntual.")) return;
            void confirmFinalists();
          }}
          data-testid="finalists-confirm-package"
        >
          {busy === "confirm" ? "Confirmando…" : "Confirmar finalistas para voto público"}
        </button>
      </div>

      <div className="space-y-8">
        {groups.map(([promptExternalId, rows]) => (
          <div key={promptExternalId} className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">
              {rows[0]?.promptTitle ?? promptExternalId}
              {rows[0]?.promptSequence != null ? ` · C${String(rows[0].promptSequence).padStart(2, "0")}` : ""}
            </h3>
            <div className="grid gap-6 sm:grid-cols-3">
              {rows
                .sort((a, b) => a.internalJuryRank - b.internalJuryRank)
                .map((row) => (
                  <div
                    key={row.id}
                    className="fr-recuadro flex flex-col gap-4 border border-fr-border/60 bg-fr-bg/40"
                    data-testid={`finalist-card-${row.id}`}
                  >
                    <div className="aspect-square w-full overflow-hidden rounded-lg bg-black">
                      {row.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={row.previewUrl}
                          alt={`Finalista ${row.publicCode}`}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-fr-muted">
                          Sin preview
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <p className="font-semibold text-gold">{row.publicCode}</p>
                      <p className="text-fr-muted">Código anónimo: {row.anonymousCode}</p>
                      <p className="text-fr-muted">
                        Score jurado (interno):{" "}
                        <span className="text-fr-primary">
                          {row.normalizedScore != null ? row.normalizedScore.toFixed(2) : "—"}
                        </span>
                      </p>
                      <p className="text-fr-muted">
                        Asset social:{" "}
                        <span className={row.derivativeStatus === "READY" ? "text-emerald-300" : "text-amber-300"}>
                          {DERIVATIVE_LABEL[row.derivativeStatus] ?? row.derivativeStatus}
                        </span>
                      </p>
                      <p className="text-fr-muted">
                        Estado:{" "}
                        <span
                          className={
                            row.status === "CONFIRMED"
                              ? "text-emerald-300"
                              : row.status === "REVOKED"
                                ? "text-red-300"
                                : "text-fr-primary"
                          }
                        >
                          {STATUS_LABEL[row.status] ?? row.status}
                        </span>
                      </p>
                      {row.status === "REVOKED" && row.revokeReason ? (
                        <p className="text-xs text-fr-muted">Motivo: {row.revokeReason}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="fr-btn fr-btn-secondary min-h-11 px-3 text-xs"
                        onClick={() =>
                          setSocialPreviewRowId((current) => (current === row.id ? null : row.id))
                        }
                        data-testid={`finalist-preview-toggle-${row.id}`}
                      >
                        {socialPreviewRowId === row.id ? "Cerrar preview" : "Preview social"}
                      </button>
                      {row.status !== "REVOKED" ? (
                        <button
                          type="button"
                          className="fr-btn fr-btn-secondary min-h-11 px-3 text-xs"
                          disabled={busy !== null}
                          onClick={() => void revokeFinalist(row)}
                          data-testid={`finalist-revoke-${row.id}`}
                        >
                          {busy === `revoke-${row.id}` ? "Revocando…" : "Revocar"}
                        </button>
                      ) : null}
                    </div>

                    {socialPreviewRowId === row.id ? (
                      <div
                        className="rounded-xl border border-fr-border bg-black/60 p-3 text-xs text-fr-muted"
                        data-testid={`finalist-social-preview-${row.id}`}
                      >
                        <p className="font-semibold text-fr-primary">Vista previa (placeholder — no publica)</p>
                        <div className="mt-2 aspect-square w-full overflow-hidden rounded-md bg-black">
                          {row.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.previewUrl} alt="" className="h-full w-full object-contain" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-fr-primary">
                          {rows[0]?.promptTitle ?? promptExternalId} — {row.publicCode}
                        </p>
                        <p className="mt-1">Copy: &ldquo;¡Votá a este finalista!&rdquo; (placeholder, sin red conectada)</p>
                      </div>
                    ) : null}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
