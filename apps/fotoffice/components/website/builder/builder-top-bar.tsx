"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { publishWebsiteAction, unpublishWebsiteAction, type WebsitePublishState } from "@/app/actions/website";
import type { WebsiteChangeStatus } from "@/lib/website/change-status";
import { DeviceToggle, type DeviceWidth } from "./device-toggle";
import type { AutosaveStatus } from "@/lib/website/use-draft-autosave";

const initial: WebsitePublishState = { error: null };

export function BuilderTopBar({
  status,
  canEdit,
  draftUpdatedAt,
  device,
  onDeviceChange,
  autosaveStatus,
  autosaveError,
  onDraftUpdatedAtChange,
}: {
  status: WebsiteChangeStatus;
  canEdit: boolean;
  draftUpdatedAt: string;
  device: DeviceWidth;
  onDeviceChange: (d: DeviceWidth) => void;
  autosaveStatus: AutosaveStatus;
  autosaveError: string | null;
  /** Publicar/Despublicar también actualizan `updatedAt` del borrador — el autosave de
   * secciones/diseño necesita enterarse para no reportar un conflicto falso en la próxima
   * edición (ver comentario en `WebsitePublishState`). */
  onDraftUpdatedAtChange: (updatedAt: string) => void;
}) {
  const [publishState, publishAction, publishPending] = useActionState(publishWebsiteAction, initial);
  const [unpublishState, unpublishAction, unpublishPending] = useActionState(unpublishWebsiteAction, initial);

  useEffect(() => {
    if (publishState.ok && publishState.updatedAt) onDraftUpdatedAtChange(publishState.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishState]);

  useEffect(() => {
    if (unpublishState.ok && unpublishState.updatedAt) onDraftUpdatedAtChange(unpublishState.updatedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unpublishState]);

  const isPublished = status === "PUBLISHED_NO_CHANGES" || status === "PUBLISHED_WITH_CHANGES";
  const hasPendingChanges = status === "PUBLISHED_WITH_CHANGES";
  const publishLabel = isPublished ? "Publicar cambios" : "Publicar";
  const publishDisabled = !canEdit || publishPending || status === "PUBLISHED_NO_CHANGES";

  return (
    <div className="border-b border-[var(--fo-border)] bg-[var(--fo-bg-elevated)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--fo-text)] truncate">Sitio web — Home</p>
          </div>
          <DeviceToggle value={device} onChange={onDeviceChange} />
          <AutosaveIndicator status={autosaveStatus} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPendingChanges ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-warning-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fo-warning)] border border-[var(--fo-warning-border)]">
              ● Cambios sin publicar
            </span>
          ) : isPublished ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fo-success-soft)] px-2.5 py-1 text-xs font-medium text-[var(--fo-success)] border border-[var(--fo-success-border)]">
              ✓ Sitio actualizado
            </span>
          ) : null}

          <Link href="/website/preview" target="_blank" className="fo-btn fo-btn-secondary text-sm">
            Vista externa
          </Link>

          {isPublished ? (
            <form action={unpublishAction}>
              <button type="submit" className="fo-btn fo-btn-ghost text-sm" disabled={!canEdit || unpublishPending}>
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
      {autosaveStatus === "conflict" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--fo-danger-border)] bg-[var(--fo-danger-soft)] px-4 py-2.5">
          <p className="text-sm text-[var(--fo-danger)]">{autosaveError || "Hay una versión más nueva del borrador — otra sesión guardó cambios. Para no perder tu edición local, dejamos de guardar automáticamente."}</p>
          <button type="button" className="fo-btn fo-btn-danger text-xs shrink-0" onClick={() => window.location.reload()}>
            Recargar cambios
          </button>
        </div>
      ) : null}
      {publishState.error ? (
        <p className="px-4 pb-2 text-xs text-[var(--fo-danger)]" role="alert">
          {publishState.error}
        </p>
      ) : null}
      {unpublishState.error ? (
        <p className="px-4 pb-2 text-xs text-[var(--fo-danger)]" role="alert">
          {unpublishState.error}
        </p>
      ) : null}
    </div>
  );
}

function AutosaveIndicator({ status }: { status: AutosaveStatus }) {
  const label =
    status === "saving"
      ? "Guardando…"
      : status === "saved"
        ? "Guardado ✓"
        : status === "conflict"
          ? "Conflicto — ver abajo"
          : status === "error"
            ? "Error al guardar"
            : status === "dirty"
              ? "Cambios…"
              : null;
  if (!label) return null;
  return (
    <span
      className={["text-xs", status === "error" || status === "conflict" ? "text-[var(--fo-danger)]" : "text-[var(--fo-muted)]"].join(" ")}
      role={status === "conflict" ? "alert" : undefined}
    >
      {label}
    </span>
  );
}
