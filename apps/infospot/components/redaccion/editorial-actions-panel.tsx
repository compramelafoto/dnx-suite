"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveArticleAction,
  archiveArticleAction,
  publishArticleAction,
  returnArticleWithObservationAction,
  submitArticleForReviewAction,
  unpublishArticleAction,
} from "@/app/actions/editorial-workflow";
import {
  approveEventAction,
  archiveEventEditorialAction,
  publishEventEditorialAction,
  returnEventWithObservationAction,
  submitEventForReviewAction,
  unpublishEventAction,
} from "@/app/actions/event-editorial-workflow";
import {
  availableEditorialActions,
  expectedActionHint,
  hasPendingReturn,
  STATUS_LABELS,
  type ArticleStatus,
  type EditorialAction,
} from "@/lib/article-status";
import {
  availableEventEditorialActions,
  expectedEventActionHint,
  hasPendingEventReturn,
  EVENT_STATUS_LABELS,
  type EventStatus,
} from "@/lib/editorial/event-adapter";
import type { InfoSpotPermissionSubject } from "@repo/db";

type Observation = {
  message: string;
  createdAt: Date | string;
  authorName: string;
};

type WorkflowResult = { ok: true; message: string } | { ok: false; error: string };

type SharedProps = {
  status: ArticleStatus | EventStatus;
  subject: InfoSpotPermissionSubject;
  returnedAt?: Date | string | null;
  submittedForReviewAt?: Date | string | null;
  latestReturn?: Observation | null;
  checklistMissing?: string[];
  canPublish: boolean;
  isDirector: boolean;
};

const primaryBtn =
  "inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--is-accent-hover)] disabled:opacity-50";
const secondaryBtn =
  "inline-flex min-h-11 w-full items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-4 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] disabled:opacity-50";

function primaryActionFor(
  actions: EditorialAction[],
  status: string,
  isDirector: boolean,
): EditorialAction | null {
  if (status === "DRAFT") {
    if (actions.includes("PUBLISH")) return "PUBLISH";
    if (actions.includes("SUBMIT_REVIEW")) return "SUBMIT_REVIEW";
  }
  if (status === "IN_REVIEW" || status === "READY_TO_PUBLISH") {
    // ETAPA 15: APPROVE ya no se ofrece en UI; PUBLISH es la acción primaria
    if (actions.includes("PUBLISH")) return "PUBLISH";
    if (!isDirector) return null;
  }
  if (status === "UNPUBLISHED" && actions.includes("PUBLISH")) return "PUBLISH";
  if (status === "PUBLISHED" && actions.includes("UNPUBLISH")) return "UNPUBLISH";
  return null;
}

function EditorialActionsPanelInner({
  status,
  actions,
  statusLabels,
  hint,
  contentNoun,
  pendingReturn,
  pendingReturnLabel,
  latestReturn,
  checklistMissing = [],
  canPublish,
  isDirector,
  onRun,
}: {
  status: string;
  actions: EditorialAction[];
  statusLabels: Record<string, string>;
  hint: string;
  contentNoun: string;
  pendingReturn: boolean;
  pendingReturnLabel: string;
  latestReturn?: Observation | null;
  checklistMissing?: string[];
  canPublish: boolean;
  isDirector: boolean;
  onRun: (action: EditorialAction, opts?: { observation?: string }) => Promise<WorkflowResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [observation, setObservation] = useState("");

  const primary = primaryActionFor(actions, status, isDirector);
  const secondary = actions.filter((a) => {
    if (a === primary) return false;
    // ETAPA 15: APPROVE no se muestra en UI (es alias interno de PUBLISH)
    if (a === "APPROVE") return false;
    if (primary === "PUBLISH" && a === "SUBMIT_REVIEW") return false;
    if (primary === "SUBMIT_REVIEW" && a === "PUBLISH") return false;
    if (status === "DRAFT" && a === "SUBMIT_REVIEW") return false;
    return true;
  });

  function run(action: EditorialAction, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await onRun(action);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  function submitReturn() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await onRun("RETURN", { observation });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReturnOpen(false);
      setObservation("");
      setMessage(result.message);
      router.refresh();
    });
  }

  const labels: Record<EditorialAction, string> = {
    SUBMIT_REVIEW: "Enviar a revisión",
    RETURN: "Devolver con observación",
    APPROVE: "Publicar ahora",
    PUBLISH: "Publicar ahora",
    UNPUBLISH: "Despublicar",
    ARCHIVE: "Archivar",
  };

  return (
    <div className="space-y-4 rounded-[var(--is-radius-md)] border border-[var(--is-border)] bg-[var(--is-surface)] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
          Flujo editorial
        </p>
        <p className="mt-2 text-sm font-semibold text-[var(--is-text)]">
          {statusLabels[status] ?? status}
          {pendingReturn ? ` · ${pendingReturnLabel}` : ""}
        </p>
        <p className="mt-1 text-sm text-[var(--is-muted)]">{hint}</p>
      </div>

      {latestReturn && pendingReturn ? (
        <div className="rounded-[var(--is-radius-sm)] border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">Observación del Director</p>
          <p className="mt-2 leading-relaxed">{latestReturn.message}</p>
          <p className="mt-2 text-xs text-amber-800">
            {latestReturn.authorName} ·{" "}
            {new Date(latestReturn.createdAt).toLocaleString("es-AR")}
          </p>
        </div>
      ) : null}

      {checklistMissing.length > 0 && status === "IN_REVIEW" ? (
        <div className="rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-[var(--is-bg-secondary)] p-3 text-xs text-[var(--is-text-secondary)]">
          Pendientes del checklist: {checklistMissing.join(" · ")}
        </div>
      ) : null}

      {!canPublish ? (
        <p className="text-xs text-[var(--is-muted)]">
          Tu rol no publica directo: al pulsar Publicar el {contentNoun} queda pendiente de
          aprobación del Director.
        </p>
      ) : null}

      <div className="space-y-2">
        {primary ? (
          <button
            type="button"
            className={primaryBtn}
            disabled={pending}
            onClick={() =>
              run(
                primary,
                primary === "PUBLISH" || primary === "APPROVE"
                  ? `¿Publicar ahora este ${contentNoun} en el sitio?`
                  : primary === "ARCHIVE"
                    ? `¿Archivar este ${contentNoun}?`
                    : undefined,
              )
            }
          >
            {labels[primary]}
          </button>
        ) : null}

        {secondary.includes("RETURN") ? (
          returnOpen ? (
            <div className="space-y-3 rounded-[var(--is-radius-sm)] border border-[var(--is-border)] p-3">
              <label className="text-sm font-semibold" htmlFor="return-obs">
                Observación para devolver
              </label>
              <textarea
                id="return-obs"
                rows={3}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] px-3 py-2 text-sm"
                placeholder="Ej: Confirmar el nombre completo del organizador y revisar la portada."
              />
              <div className="flex gap-2">
                <button type="button" className={secondaryBtn} disabled={pending} onClick={submitReturn}>
                  Confirmar devolución
                </button>
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => setReturnOpen(false)}
                  disabled={pending}
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() => setReturnOpen(true)}
            >
              Devolver con observación
            </button>
          )
        ) : null}

        {secondary
          .filter((a) => a !== "RETURN")
          .map((action) => (
            <button
              key={action}
              type="button"
              className={secondaryBtn}
              disabled={pending}
              onClick={() =>
                run(
                  action,
                  action === "PUBLISH" || action === "APPROVE"
                    ? `¿Publicar ahora este ${contentNoun} en el sitio?`
                    : action === "UNPUBLISH"
                      ? `¿Despublicar este ${contentNoun}?`
                      : action === "ARCHIVE"
                        ? `¿Archivar este ${contentNoun}?`
                        : undefined,
                )
              }
            >
              {labels[action]}
            </button>
          ))}
      </div>

      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}

export function EditorialActionsPanel({
  articleId,
  status,
  subject,
  returnedAt,
  submittedForReviewAt,
  latestReturn,
  checklistMissing = [],
  canPublish,
  isDirector,
}: SharedProps & { articleId: string }) {
  const pendingReturn = hasPendingReturn({ status, returnedAt, submittedForReviewAt });
  const actions = availableEditorialActions(subject, status, {
    returnedAt,
    submittedForReviewAt,
  });

  return (
    <EditorialActionsPanelInner
      status={status}
      actions={actions}
      statusLabels={STATUS_LABELS}
      hint={expectedActionHint(status, { pendingReturn, isDirector, canPublish })}
      contentNoun="nota"
      pendingReturn={pendingReturn}
      pendingReturnLabel="Devuelta"
      latestReturn={latestReturn}
      checklistMissing={checklistMissing}
      canPublish={canPublish}
      isDirector={isDirector}
      onRun={async (action, opts) => {
        switch (action) {
          case "SUBMIT_REVIEW":
            return submitArticleForReviewAction(articleId);
          case "APPROVE":
            return approveArticleAction(articleId);
          case "PUBLISH":
            return publishArticleAction(articleId);
          case "UNPUBLISH":
            return unpublishArticleAction(articleId);
          case "ARCHIVE":
            return archiveArticleAction(articleId);
          case "RETURN":
            return returnArticleWithObservationAction(articleId, opts?.observation ?? "");
          default:
            return { ok: false, error: "Acción no reconocida." };
        }
      }}
    />
  );
}

export function EventEditorialActionsPanel({
  eventId,
  status,
  subject,
  returnedAt,
  submittedForReviewAt,
  latestReturn,
  checklistMissing = [],
  canPublish,
  isDirector,
}: SharedProps & { eventId: string; status: EventStatus }) {
  const pendingReturn = hasPendingEventReturn({ status, returnedAt, submittedForReviewAt });
  const actions = availableEventEditorialActions(subject, status, {
    returnedAt,
    submittedForReviewAt,
  });

  return (
    <EditorialActionsPanelInner
      status={status}
      actions={actions}
      statusLabels={EVENT_STATUS_LABELS}
      hint={expectedEventActionHint(status, { pendingReturn, isDirector, canPublish })}
      contentNoun="evento"
      pendingReturn={pendingReturn}
      pendingReturnLabel="Devuelto"
      latestReturn={latestReturn}
      checklistMissing={checklistMissing}
      canPublish={canPublish}
      isDirector={isDirector}
      onRun={async (action, opts) => {
        switch (action) {
          case "SUBMIT_REVIEW":
            return submitEventForReviewAction(eventId);
          case "APPROVE":
            return approveEventAction(eventId);
          case "PUBLISH":
            return publishEventEditorialAction(eventId);
          case "UNPUBLISH":
            return unpublishEventAction(eventId);
          case "ARCHIVE":
            return archiveEventEditorialAction(eventId);
          case "RETURN":
            return returnEventWithObservationAction(eventId, opts?.observation ?? "");
          default:
            return { ok: false, error: "Acción no reconocida." };
        }
      }}
    />
  );
}
