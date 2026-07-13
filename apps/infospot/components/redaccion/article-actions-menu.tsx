"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { duplicateArticleDraftAction } from "@/app/actions/articles";
import { transitionArticleStatusAction } from "@/app/actions/editorial-workflow";
import { canTransitionStatus, type ArticleStatus } from "@/lib/article-status";

type Props = {
  articleId: string;
  status: ArticleStatus;
  canPublish: boolean;
};

export function ArticleActionsMenu({ articleId, status, canPublish }: Props) {
  const router = useRouter();
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function runTransition(to: ArticleStatus, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setOpen(false);
    startTransition(async () => {
      const result = await transitionArticleStatusAction(articleId, to);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function runDuplicate() {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      await duplicateArticleDraftAction(articleId);
    });
  }

  const canPublishNow =
    canPublish && canTransitionStatus(status, "PUBLISHED") && status !== "PUBLISHED";
  const canUnpublish = canPublish && canTransitionStatus(status, "UNPUBLISHED");
  const canArchive = canTransitionStatus(status, "ARCHIVED");

  const itemClass =
    "flex min-h-11 w-full items-center px-3 text-left text-sm text-[var(--is-text)] hover:bg-[var(--is-bg-elevated)] disabled:opacity-50";

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <Link
          href={`/redaccion/noticias/${articleId}/editar`}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3.5 text-sm font-medium text-[var(--is-text)] hover:border-[var(--is-accent)] hover:text-[var(--is-accent)]"
        >
          Editar
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-controls={menuId}
          disabled={pending}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] bg-white text-[var(--is-text-secondary)] hover:border-[var(--is-border-strong)] hover:text-[var(--is-text)] disabled:opacity-50"
        >
          <span className="sr-only">Más acciones</span>
          <span aria-hidden className="text-lg leading-none">
            ···
          </span>
        </button>
      </div>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-[12.5rem] overflow-hidden rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white py-1"
        >
          <Link
            role="menuitem"
            href={`/redaccion/noticias/${articleId}/preview`}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            Vista previa
          </Link>
          <button type="button" role="menuitem" className={itemClass} disabled={pending} onClick={runDuplicate}>
            Duplicar
          </button>
          {canPublishNow ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              disabled={pending}
              onClick={() => runTransition("PUBLISHED")}
            >
              Publicar
            </button>
          ) : null}
          {canUnpublish ? (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              disabled={pending}
              onClick={() => runTransition("UNPUBLISHED")}
            >
              Despublicar
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              role="menuitem"
              className={`${itemClass} text-[var(--is-muted)]`}
              disabled={pending}
              onClick={() =>
                runTransition(
                  "ARCHIVED",
                  "¿Archivar esta nota? Dejará de editarse en el flujo normal.",
                )
              }
            >
              Archivar
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
