"use client";

import { useActionState } from "react";
import { toggleWebsitePublishAction, type WebsitePublishState } from "@/app/actions/website";

const initial: WebsitePublishState = { error: null };

export function WebsitePublishForm({
  published,
  canEdit,
}: {
  published: boolean;
  canEdit: boolean;
}) {
  const [state, action, pending] = useActionState(toggleWebsitePublishAction, initial);

  return (
    <form action={action} className="fo-card space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--fo-text)]">Estado del sitio</h2>
        <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed">
          {published
            ? "El sitio está publicado."
            : "El sitio está en borrador. Todavía no es público."}
        </p>
      </div>
      <input type="hidden" name="publish" value={(!published).toString()} />
      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {canEdit ? (
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando…" : published ? "Despublicar" : "Publicar"}
        </button>
      ) : null}
    </form>
  );
}
