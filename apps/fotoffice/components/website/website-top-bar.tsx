"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  publishWebsiteAction,
  unpublishWebsiteAction,
  type WebsitePublishState,
} from "@/app/actions/website";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";

const initial: WebsitePublishState = { error: null };

export function WebsiteTopBar({
  status,
  canEdit,
  draftUpdatedAt,
}: {
  status: WebsiteChangeStatus;
  canEdit: boolean;
  /** `updatedAt` del borrador tal como se cargó esta pantalla — habilita concurrencia optimista. */
  draftUpdatedAt: string;
}) {
  const [publishState, publishAction, publishPending] = useActionState(publishWebsiteAction, initial);
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishWebsiteAction, initial);

  const isPublished = status === "PUBLISHED_NO_CHANGES" || status === "PUBLISHED_WITH_CHANGES";
  const hasPendingChanges = status === "PUBLISHED_WITH_CHANGES";
  const publishLabel = isPublished ? "Publicar cambios" : "Publicar";
  const publishDisabled = !canEdit || publishPending || status === "PUBLISHED_NO_CHANGES";

  return (
    <div className="fo-card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--fo-text)] truncate">Sitio web</p>
            <p className="text-xs text-[var(--fo-muted)]">Home</p>
          </div>
          <StatusPill isPublished={isPublished} />
          {hasPendingChanges ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-warning-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fo-warning)] border border-[var(--fo-warning-border)]">
              Hay cambios sin publicar
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/website/preview" target="_blank" className="fo-btn fo-btn-secondary text-sm">
            Vista previa
          </Link>

          {isPublished ? (
            <form action={unpublishAction}>
              <button
                type="submit"
                className="fo-btn fo-btn-ghost text-sm"
                disabled={!canEdit || unpublishPending}
              >
                {unpublishPending ? "Despublicando…" : "Despublicar"}
              </button>
            </form>
          ) : null}

          {canEdit ? (
            <form action={publishAction}>
              <input type="hidden" name="draftUpdatedAt" value={draftUpdatedAt} />
              <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={publishDisabled}>
                {publishPending ? "Publicando…" : publishLabel}
              </button>
            </form>
          ) : null}
        </div>
      </div>

      {publishState.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {publishState.error}
        </p>
      ) : null}
      {unpublishState.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {unpublishState.error}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ isPublished }: { isPublished: boolean }) {
  if (isPublished) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fo-success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fo-success)] border border-[var(--fo-success-border)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--fo-success)]" />
        Publicado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fo-border-muted)] px-2.5 py-1 text-xs font-medium text-[var(--fo-muted)] border border-[var(--fo-border)]">
      <span className="h-1.5 w-1.5 rounded-full border border-[var(--fo-muted)]" />
      Borrador · No publicado
    </span>
  );
}
