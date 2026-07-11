"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { transitionArticleStatusAction } from "@/app/actions/articles";
import type { ArticleStatus } from "@/lib/article-status";
import { canTransitionStatus } from "@/lib/article-status";

type Props = {
  articleId: string;
  status: ArticleStatus;
  canPublish: boolean;
};

const btn =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border px-3 text-sm font-medium transition-colors disabled:opacity-50";

export function ArticleStatusActions({ articleId, status, canPublish }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(to: ArticleStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await transitionArticleStatusAction(articleId, to);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canPublish && canTransitionStatus(status, "PUBLISHED") && status !== "PUBLISHED" ? (
          <button
            type="button"
            disabled={pending}
            className={`${btn} border-teal-700 bg-teal-700 text-white hover:bg-teal-800`}
            onClick={() => run("PUBLISHED")}
          >
            Publicar
          </button>
        ) : null}
        {canPublish && canTransitionStatus(status, "UNPUBLISHED") ? (
          <button
            type="button"
            disabled={pending}
            className={`${btn} border-[var(--is-border-strong)] bg-white text-[var(--is-text)] hover:border-[var(--is-accent)]`}
            onClick={() => run("UNPUBLISHED")}
          >
            Despublicar
          </button>
        ) : null}
        {canTransitionStatus(status, "ARCHIVED") ? (
          <button
            type="button"
            disabled={pending}
            className={`${btn} border-stone-400 bg-stone-100 text-stone-800 hover:bg-stone-200`}
            onClick={() => run("ARCHIVED", "¿Archivar esta noticia? Dejará de editarse en el flujo normal.")}
          >
            Archivar
          </button>
        ) : null}
      </div>
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
