"use client";

import { useState, useTransition } from "react";
import {
  cancelCampaignFromAdminAction,
  retryCampaignFromAdminAction,
  processNotificationsNowAction,
  reconcileNotificationsDryRunAction,
  reconcileNotificationsApplyAction,
  type CampaignOpsResult,
} from "@/app/actions/notification-campaigns";

type Props = {
  campaignId: string;
  pendingCount: number;
  failedCount: number;
  canCancelRetry: boolean;
  canProcessNow: boolean;
  canReconcile: boolean;
  canApplyReconcile: boolean;
};

export function NotificationCampaignOps({
  campaignId,
  pendingCount,
  failedCount,
  canCancelRetry,
  canProcessNow,
  canReconcile,
  canApplyReconcile,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmRetry, setConfirmRetry] = useState(false);
  const [reconcileJson, setReconcileJson] = useState<string | null>(null);

  function handleResult(result: CampaignOpsResult) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    if (result.kind === "cancelled") {
      setMessage(`Canceladas ${result.cancelledPending} entregas pendientes/fallidas.`);
      setConfirmCancel(false);
      setReason("");
    } else if (result.kind === "retried") {
      setMessage(
        `Reencoladas ${result.requeued}. Worker: ${result.sent} enviadas, ${result.failed} fallidas.`,
      );
      setConfirmRetry(false);
    } else if (result.kind === "processed") {
      setMessage(
        `Procesado: claimed=${result.claimed}, sent=${result.sent}, failed=${result.failed}.`,
      );
    } else if (result.kind === "reconcile") {
      setReconcileJson(JSON.stringify(result.report, null, 2));
      setMessage(
        result.report.dryRun
          ? "Reconciliación dry-run completada."
          : "Reconciliación aplicada.",
      );
    }
  }

  return (
    <section className="space-y-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5">
      <h2 className="text-base font-semibold tracking-tight">Acciones operativas</h2>

      {canCancelRetry ? (
        <div className="space-y-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-4">
          <p className="text-sm text-[var(--is-muted)]">
            Pendientes / procesando: <strong>{pendingCount}</strong>. Fallidas:{" "}
            <strong>{failedCount}</strong>.
          </p>
          <label className="block text-sm">
            <span className="font-medium">Motivo de cancelación</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="is-input mt-2"
              placeholder="Ej. audiencia incorrecta / prueba QA"
            />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={confirmCancel}
              onChange={(e) => setConfirmCancel(e.target.checked)}
              className="mt-1 size-4"
            />
            <span>
              Confirmo cancelar las {pendingCount} entregas pendientes (las enviadas se
              conservan).
            </span>
          </label>
          <button
            type="button"
            disabled={pending || !confirmCancel || !reason.trim()}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-red-300 px-4 text-sm font-semibold text-red-800 disabled:opacity-60"
            onClick={() => {
              const fd = new FormData();
              fd.set("reason", reason.trim());
              startTransition(async () => {
                handleResult(await cancelCampaignFromAdminAction(campaignId, fd));
              });
            }}
          >
            Cancelar entregas pendientes
          </button>

          <label className="flex items-start gap-3 text-sm pt-2">
            <input
              type="checkbox"
              checked={confirmRetry}
              onChange={(e) => setConfirmRetry(e.target.checked)}
              className="mt-1 size-4"
            />
            <span>
              Confirmo reintentar hasta {failedCount} entregas fallidas (omite definitivas /
              máx. intentos).
            </span>
          </label>
          <button
            type="button"
            disabled={pending || !confirmRetry || failedCount <= 0}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-semibold disabled:opacity-60"
            onClick={() => {
              startTransition(async () => {
                handleResult(await retryCampaignFromAdminAction(campaignId));
              });
            }}
          >
            Reintentar entregas fallidas
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--is-muted)]">
          Cancelación y reintentos: solo Director o SUPER_ADMIN.
        </p>
      )}

      {canProcessNow ? (
        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
          onClick={() => {
            startTransition(async () => {
              handleResult(await processNotificationsNowAction());
            });
          }}
        >
          Procesar ahora
        </button>
      ) : null}

      {canReconcile ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-4 text-sm font-semibold disabled:opacity-60"
            onClick={() => {
              startTransition(async () => {
                handleResult(await reconcileNotificationsDryRunAction());
              });
            }}
          >
            Verificar consistencia
          </button>
          {canApplyReconcile ? (
            <button
              type="button"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-amber-400 px-4 text-sm font-semibold text-amber-900 disabled:opacity-60"
              onClick={() => {
                if (!window.confirm("¿Aplicar reparación de métricas/locks?")) return;
                startTransition(async () => {
                  handleResult(await reconcileNotificationsApplyAction());
                });
              }}
            >
              Aplicar reparación
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
          {message}
        </p>
      ) : null}
      {reconcileJson ? (
        <pre className="overflow-x-auto rounded border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-3 text-xs">
          {reconcileJson}
        </pre>
      ) : null}
    </section>
  );
}
