"use client";

import { useActionState } from "react";
import { saveWebsiteSeoAction, type WebsiteDraftSaveState } from "@/app/actions/website";

const initial: WebsiteDraftSaveState = { error: null };

export function WebsiteSeoForm({
  initialSeoTitle,
  initialSeoDescription,
  canEdit,
  draftUpdatedAt,
}: {
  initialSeoTitle: string | null;
  initialSeoDescription: string | null;
  canEdit: boolean;
  draftUpdatedAt: string;
}) {
  const [state, action, pending] = useActionState(saveWebsiteSeoAction, initial);

  return (
    <form action={action} className="fo-card space-y-5">
      <input type="hidden" name="draftUpdatedAt" value={draftUpdatedAt} />
      <fieldset disabled={!canEdit} className="space-y-5 border-0">
        <label className="block space-y-2">
          <span className="fo-label">Título para buscadores</span>
          <input name="seoTitle" defaultValue={initialSeoTitle ?? ""} className="fo-input" maxLength={200} />
          <p className="fo-helper">Lo que se ve como título cuando tu sitio aparece en Google.</p>
        </label>
        <label className="block space-y-2">
          <span className="fo-label">Descripción para buscadores</span>
          <textarea name="seoDescription" defaultValue={initialSeoDescription ?? ""} rows={3} className="fo-input" maxLength={400} />
          <p className="fo-helper">Un resumen corto que acompaña al título en los resultados de búsqueda.</p>
        </label>
      </fieldset>
      {state.error ? <p className="text-sm text-[var(--fo-danger)]">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar SEO"}
        </button>
      ) : null}
    </form>
  );
}
