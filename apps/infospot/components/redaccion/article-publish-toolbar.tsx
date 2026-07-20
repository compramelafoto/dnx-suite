"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  publishArticleAction,
  unpublishArticleAction,
} from "@/app/actions/editorial-workflow";
import {
  availableEditorialActions,
  STATUS_LABELS,
  type ArticleStatus,
} from "@/lib/article-status";
import type { InfoSpotPermissionSubject } from "@repo/db";

type Props = {
  articleId: string;
  status: ArticleStatus;
  subject: InfoSpotPermissionSubject;
  canPublish: boolean;
  checklistMissing?: string[];
};

/**
 * Acciones de publicar / despublicar visibles junto a Guardar.
 */
export function ArticlePublishToolbar({
  articleId,
  status,
  subject,
  canPublish,
  checklistMissing = [],
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const actions = availableEditorialActions(subject, status);
  const canPublishNow = actions.includes("PUBLISH");
  const canUnpublishNow = actions.includes("UNPUBLISH");

  function runPublish() {
    if (checklistMissing.length > 0) {
      setError(`Falta completar: ${checklistMissing.slice(0, 3).join(" · ")}`);
      return;
    }
    if (!window.confirm("¿Publicar ahora esta nota en el sitio?")) return;
    setError(null);
    startTransition(async () => {
      const result = await publishArticleAction(articleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function runUnpublish() {
    if (!window.confirm("¿Despublicar esta nota? Dejará de verse en el sitio.")) return;
    setError(null);
    startTransition(async () => {
      const result = await unpublishArticleAction(articleId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <span
        className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-semibold ${
          status === "PUBLISHED"
            ? "border-teal-300 bg-teal-50 text-teal-900"
            : status === "UNPUBLISHED"
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-[var(--is-border)] bg-[var(--is-bg-muted)] text-[var(--is-text)]"
        }`}
        title="Estado de publicación"
      >
        {STATUS_LABELS[status] ?? status}
      </span>

      {canPublishNow ? (
        <button
          type="button"
          className="is-btn is-btn-primary disabled:opacity-60"
          disabled={pending || !canPublish}
          onClick={runPublish}
          title={
            !canPublish
              ? "Tu rol no publica directo; se enviará a revisión"
              : checklistMissing.length > 0
                ? `Checklist incompleto: ${checklistMissing.join(", ")}`
                : "Publicar en el sitio"
          }
        >
          {pending ? "Publicando…" : "Publicar"}
        </button>
      ) : null}

      {canUnpublishNow ? (
        <button
          type="button"
          className="is-btn is-btn-secondary disabled:opacity-60"
          disabled={pending}
          onClick={runUnpublish}
        >
          {pending ? "…" : "Despublicar"}
        </button>
      ) : null}

      {error ? (
        <span className="max-w-[14rem] truncate text-[11px] text-red-700" title={error}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
