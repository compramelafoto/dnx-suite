"use client";

import { useActionState, useRef, useState } from "react";
import { deleteWorkspaceAction, type SuperAdminActionState } from "@/app/actions/super-admin";

const initial: SuperAdminActionState = { error: null, ok: null };

export function DeleteWorkspaceDialog({
  workspaceId,
  workspaceName,
  publicSlug,
}: {
  workspaceId: string;
  workspaceName: string;
  publicSlug: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmText, setConfirmText] = useState("");
  const [state, action, pending] = useActionState(deleteWorkspaceAction, initial);

  const canDelete = Boolean(publicSlug) && confirmText.trim().toLowerCase() === publicSlug;

  return (
    <>
      <button
        type="button"
        className="text-xs text-[var(--fo-danger)] hover:underline"
        onClick={() => dialogRef.current?.showModal()}
      >
        Eliminar workspace
      </button>

      <dialog
        ref={dialogRef}
        className="fo-card max-w-md w-[90vw] p-0 backdrop:bg-black/50"
        onClose={() => setConfirmText("")}
      >
        <form action={action} className="p-6 space-y-4">
          <input type="hidden" name="workspaceId" value={workspaceId} />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--fo-text)]">Eliminar workspace</h2>
            <p className="text-sm text-[var(--fo-danger)] font-medium">
              Esta acción es irreversible. Se borran permanentemente cursos, evaluaciones, sitio
              web, branding y toda la configuración de este workspace.
            </p>
          </div>

          <div className="fo-card bg-[var(--fo-bg)] space-y-1 text-sm">
            <p>
              <span className="text-[var(--fo-muted)]">Workspace:</span>{" "}
              <strong className="text-[var(--fo-text)]">{workspaceName}</strong>
            </p>
            <p>
              <span className="text-[var(--fo-muted)]">Slug:</span>{" "}
              <code className="font-mono">{publicSlug ?? "—"}</code>
            </p>
          </div>

          {!publicSlug ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Este workspace no tiene slug público — no se puede confirmar la eliminación.
            </p>
          ) : (
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="confirmSlug">
                Escribí <code className="font-mono">{publicSlug}</code> para habilitar la
                eliminación
              </label>
              <input
                id="confirmSlug"
                name="confirmSlug"
                className="fo-input font-mono"
                autoComplete="off"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          )}

          {state.error ? (
            <p className="text-sm text-[var(--fo-danger)]" role="alert">
              {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p className="text-sm text-[var(--fo-success)]" role="status">
              {state.ok}
            </p>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="fo-btn fo-btn-secondary text-sm"
              onClick={() => dialogRef.current?.close()}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="fo-btn fo-btn-danger text-sm"
              disabled={!canDelete || pending}
            >
              {pending ? "Eliminando…" : "Eliminar definitivamente"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
