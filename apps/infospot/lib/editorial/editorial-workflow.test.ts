/**
 * Núcleo editorial genérico + compatibilidad del adaptador Article.
 * Ejecutar: `pnpm --filter infospot test:editorial-workflow`
 */

import assert from "node:assert/strict";
import {
  canPerformEditorialTransition,
  canTransitionEditorialStatus,
  resolveEditorialTransition,
  resolveEffectiveEditorialTarget,
  targetStatusForEditorialAction,
} from "./editorial-workflow-core";
import type { EditorialActorCapabilities, EditorialStatus } from "./types";
import {
  ARTICLE_STATUSES,
  STATUS_LABELS,
  canPerformEditorialAction,
  canTransitionStatus,
  targetStatusForAction,
  planArticleEditorialPersist,
  availableEditorialActions,
  isArticleStatus,
  hasPendingReturn,
  expectedActionHint,
  EDITORIAL_ACTION_LABELS,
} from "./article-adapter";
// Compat: callers históricos importan desde la fachada.
import * as facade from "../article-status";
import type { InfoSpotPermissionSubject } from "@repo/db";

function actor(partial: Partial<EditorialActorCapabilities>): EditorialActorCapabilities {
  return {
    canPublish: false,
    isDirector: false,
    ...partial,
  };
}

function subject(
  partial: Partial<InfoSpotPermissionSubject> & { role: string },
): InfoSpotPermissionSubject {
  return {
    status: "ACTIVE",
    canPublish: partial.canPublish ?? false,
    ...partial,
  };
}

const director = subject({
  role: "INFOSPOT_DIRECTOR",
  canPublish: true,
  publicationPolicy: "DIRECT_PUBLISH",
});
const redactorDirect = subject({
  role: "INFOSPOT_REDACTOR",
  canPublish: true,
  publicationPolicy: "DIRECT_PUBLISH",
});
const colaborador = subject({
  role: "INFOSPOT_COLABORADOR",
  canPublish: false,
  publicationPolicy: "REQUIRES_APPROVAL",
});

// --- 1. DRAFT + SUBMIT_REVIEW → IN_REVIEW ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "DRAFT",
    action: "SUBMIT_REVIEW",
    actor: actor({}),
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.targetStatus, "IN_REVIEW");
    assert.equal(r.via, "direct");
  }
  assert.equal(targetStatusForEditorialAction("SUBMIT_REVIEW"), "IN_REVIEW");
}

// --- 2. IN_REVIEW + RETURN → DRAFT ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "IN_REVIEW",
    action: "RETURN",
    actor: actor({ isDirector: true, canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "DRAFT");
  const denied = canPerformEditorialTransition({
    contentType: "ARTICLE",
    from: "IN_REVIEW",
    action: "RETURN",
    actor: actor({ isDirector: false }),
  });
  assert.equal(denied.ok, false);
}

// --- 3. IN_REVIEW + APPROVE → READY_TO_PUBLISH ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "IN_REVIEW",
    action: "APPROVE",
    actor: actor({ isDirector: true, canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "READY_TO_PUBLISH");
}

// --- 4. READY_TO_PUBLISH + PUBLISH → PUBLISHED ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "READY_TO_PUBLISH",
    action: "PUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.targetStatus, "PUBLISHED");
    assert.equal(r.via, "direct");
  }
}

// --- 5. PUBLISHED + UNPUBLISH → UNPUBLISHED ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "PUBLISHED",
    action: "UNPUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "UNPUBLISHED");
}

// --- 6. UNPUBLISHED + PUBLISH → PUBLISHED ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "UNPUBLISHED",
    action: "PUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "PUBLISHED");
}

// --- 7. cualquier estado válido + ARCHIVE → ARCHIVED ---
{
  const fromStates: EditorialStatus[] = [
    "DRAFT",
    "IN_REVIEW",
    "READY_TO_PUBLISH",
    "PUBLISHED",
    "UNPUBLISHED",
  ];
  for (const from of fromStates) {
    const r = resolveEditorialTransition({
      contentType: "ARTICLE",
      from,
      action: "ARCHIVE",
      actor: actor({}),
    });
    assert.equal(r.ok, true, `ARCHIVE from ${from}`);
    if (r.ok) assert.equal(r.targetStatus, "ARCHIVED");
  }
}

// --- 8. sin publicación directa: PUBLISH desde DRAFT → IN_REVIEW ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "DRAFT",
    action: "PUBLISH",
    actor: actor({ canPublish: false }),
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.targetStatus, "IN_REVIEW");
    assert.equal(r.via, "submit_via_publish");
  }
  const adapter = planArticleEditorialPersist(colaborador, "DRAFT", "PUBLISH");
  assert.equal(adapter.ok, true);
  if (adapter.ok) {
    assert.equal(adapter.plan.kind, "submit_via_publish");
    assert.equal(adapter.plan.status, "IN_REVIEW");
  }
  const perm = canPerformEditorialAction(colaborador, "DRAFT", "PUBLISH");
  assert.equal(perm.ok, true);
}

// --- 9. con publicación directa: PUBLISH desde DRAFT → PUBLISHED ---
{
  const r = resolveEditorialTransition({
    contentType: "ARTICLE",
    from: "DRAFT",
    action: "PUBLISH",
    actor: actor({ canPublish: true, isDirector: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.targetStatus, "PUBLISHED");
    assert.equal(r.via, "direct");
  }
  const adapter = planArticleEditorialPersist(director, "DRAFT", "PUBLISH");
  assert.equal(adapter.ok, true);
  if (adapter.ok) {
    assert.equal(adapter.plan.kind, "standard");
    assert.equal(adapter.plan.status, "PUBLISHED");
  }
  const redactor = planArticleEditorialPersist(redactorDirect, "DRAFT", "PUBLISH");
  assert.equal(redactor.ok, true);
  if (redactor.ok) assert.equal(redactor.plan.status, "PUBLISHED");
}

// --- 10. transición inválida desde ARCHIVED ---
{
  const actions = [
    "SUBMIT_REVIEW",
    "RETURN",
    "APPROVE",
    "PUBLISH",
    "UNPUBLISH",
    "ARCHIVE",
  ] as const;
  for (const action of actions) {
    const r = canPerformEditorialTransition({
      contentType: "ARTICLE",
      from: "ARCHIVED",
      action,
      actor: actor({ canPublish: true, isDirector: true }),
    });
    assert.equal(r.ok, false, `ARCHIVED + ${action} debe fallar`);
  }
  assert.equal(canTransitionEditorialStatus("ARCHIVED", "PUBLISHED"), false);
  assert.equal(canTransitionEditorialStatus("ARCHIVED", "DRAFT"), false);
  assert.equal(canTransitionStatus("ARCHIVED", "IN_REVIEW"), false);
}

// --- 11. compatibilidad de exports anteriores ---
{
  assert.deepEqual([...ARTICLE_STATUSES], [
    "DRAFT",
    "IN_REVIEW",
    "READY_TO_PUBLISH",
    "PUBLISHED",
    "UNPUBLISHED",
    "ARCHIVED",
  ]);
  assert.equal(STATUS_LABELS.PUBLISHED, "Publicada");
  assert.equal(STATUS_LABELS.READY_TO_PUBLISH, "Lista para publicar");
  assert.equal(EDITORIAL_ACTION_LABELS.SUBMIT_REVIEW, "Enviar a revisión");
  assert.equal(isArticleStatus("DRAFT"), true);
  assert.equal(isArticleStatus("NOPE"), false);
  assert.equal(targetStatusForAction("APPROVE"), "READY_TO_PUBLISH");
  assert.equal(canTransitionStatus("DRAFT", "IN_REVIEW"), true);
  assert.equal(
    expectedActionHint("DRAFT", { canPublish: false }),
    "Completar y publicar (queda pendiente de aprobación)",
  );
  assert.equal(
    hasPendingReturn({
      status: "DRAFT",
      returnedAt: new Date("2026-01-02"),
      submittedForReviewAt: new Date("2026-01-01"),
    }),
    true,
  );
  const actions = availableEditorialActions(director, "IN_REVIEW");
  assert.ok(actions.includes("RETURN"));
  assert.ok(actions.includes("PUBLISH"));
  assert.ok(actions.includes("APPROVE"));

  // Fachada article-status.ts
  assert.equal(facade.STATUS_LABELS.ARCHIVED, "Archivada");
  assert.equal(facade.targetStatusForAction("UNPUBLISH"), "UNPUBLISHED");
  assert.equal(facade.canPerformEditorialAction(null, "DRAFT", "PUBLISH").ok, false);
  assert.deepEqual([...facade.ARTICLE_STATUSES], [...ARTICLE_STATUSES]);
}

// --- resolveEffectiveEditorialTarget sanity ---
{
  const via = resolveEffectiveEditorialTarget("DRAFT", "PUBLISH", {
    canPublish: false,
  });
  assert.equal(via.via, "submit_via_publish");
  assert.equal(via.targetStatus, "IN_REVIEW");
}

console.log("editorial-workflow tests: ok");
