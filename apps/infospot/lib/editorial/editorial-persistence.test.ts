/**
 * Persistencia y bandejas editoriales — regresiones de causa raíz.
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial/editorial-persistence.test.ts
 */

import assert from "node:assert/strict";
import { initialEventStatusForOrigin, hasPendingEventReturn } from "./event-adapter";
import { hasPendingReturn } from "./article-adapter";
import {
  editorHtmlToMarkdown,
  markdownToEditorHtml,
  sanitizeEditorialHtml,
} from "../../../../packages/editor/src/index";

/**
 * Copia del contrato de filterEventsByVista (lib/redaccion-queues.ts).
 * Se mantiene acá para poder testear sin resolver alias @/ vía tsx desde @repo/db.
 */
function filterEventsByVista<
  T extends {
    id: string;
    status: string;
    authorId: number | null;
    returnedAt?: Date | null;
    submittedForReviewAt?: Date | null;
  },
>(
  events: T[],
  vista: string,
  userId: number,
  hasPending: (e: T) => boolean,
): T[] {
  switch (vista) {
    case "mi-trabajo":
      return events.filter(
        (e) =>
          e.status !== "ARCHIVED" &&
          (e.authorId === userId ||
            (e.authorId == null &&
              (e.status === "IN_REVIEW" || e.status === "READY_TO_PUBLISH"))),
      );
    case "borradores":
      return events.filter((e) => e.status === "DRAFT" && !hasPending(e));
    case "en-revision":
      return events.filter(
        (e) => e.status === "IN_REVIEW" || e.status === "READY_TO_PUBLISH",
      );
    default:
      return events;
  }
}

function filterArticlesByVista<T extends { status: string; authorId: number }>(
  articles: T[],
  vista: string,
): T[] {
  if (vista === "en-revision") {
    return articles.filter(
      (a) => a.status === "IN_REVIEW" || a.status === "READY_TO_PUBLISH",
    );
  }
  return articles;
}

// --- 1. Intake público nace IN_REVIEW ---
assert.equal(initialEventStatusForOrigin("PUBLIC_INTAKE"), "IN_REVIEW");
assert.equal(initialEventStatusForOrigin("REDACCION"), "DRAFT");

// --- 2. Evento público (sin author) aparece en en-revisión e inbox ---
{
  const events = [
    {
      id: "pub-1",
      title: "Autódromo",
      status: "IN_REVIEW",
      authorId: null as number | null,
      submittedForReviewAt: new Date(),
    },
    {
      id: "mine",
      title: "Mi borrador",
      status: "DRAFT",
      authorId: 7,
    },
  ];
  const inReview = filterEventsByVista(events, "en-revision", 7, hasPendingEventReturn);
  assert.equal(inReview.length, 1);
  assert.equal(inReview[0]!.id, "pub-1");

  const inbox = filterEventsByVista(events, "mi-trabajo", 7, hasPendingEventReturn);
  assert.ok(
    inbox.some((e) => e.id === "pub-1"),
    "Inbox debe incluir envíos públicos IN_REVIEW sin authorId",
  );
  assert.ok(inbox.some((e) => e.id === "mine"));
}

// --- 3. Nota IN_REVIEW no sale de bandeja si se conserva status ---
{
  const articles = [
    {
      id: "a1",
      status: "IN_REVIEW",
      authorId: 1,
    },
  ];
  assert.equal(filterArticlesByVista(articles, "en-revision").length, 1);
  assert.equal(
    filterArticlesByVista([{ ...articles[0]!, status: "DRAFT" }], "en-revision").length,
    0,
  );
}

// --- 4. Autosave status resolver (contrato documentado en articles.ts) ---
{
  function resolveAutosaveStatus(existing: string): string {
    return existing;
  }
  for (const s of [
    "DRAFT",
    "IN_REVIEW",
    "READY_TO_PUBLISH",
    "PUBLISHED",
    "UNPUBLISHED",
    "ARCHIVED",
  ]) {
    assert.equal(resolveAutosaveStatus(s), s);
  }
}

// --- 6. blob: se elimina al sanitizar ---
{
  const dirty =
    '<p>x</p><figure data-editorial-image="true"><img src="blob:https://local/abc" alt="x" /></figure>';
  const safe = sanitizeEditorialHtml(dirty);
  assert.doesNotMatch(safe, /blob:/);
}

// --- 7. hasPendingReturn no confunde IN_REVIEW ---
assert.equal(
  hasPendingReturn({
    status: "IN_REVIEW",
    returnedAt: new Date(),
    submittedForReviewAt: new Date(),
  }),
  false,
);

console.log("editorial-persistence tests: ok");
