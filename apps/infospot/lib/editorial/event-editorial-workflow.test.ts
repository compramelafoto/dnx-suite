/**
 * Tests del adaptador EVENT + núcleo editorial.
 * Ejecutar: `pnpm --filter infospot test:editorial-workflow`
 */

import assert from "node:assert/strict";
import {
  canPerformEditorialTransition,
  resolveEditorialTransition,
} from "./editorial-workflow-core";
import type { EditorialActorCapabilities, EditorialStatus } from "./types";
import {
  canPerformEventEditorialAction,
  initialEventStatusForOrigin,
  mapLegacyEventStatus,
  planEventEditorialPersist,
  validateEventForPublish,
  EVENT_STATUS_LABELS,
  hasPendingEventReturn,
} from "./event-adapter";
import type { InfoSpotPermissionSubject } from "@repo/db";

function actor(partial: Partial<EditorialActorCapabilities>): EditorialActorCapabilities {
  return { canPublish: false, isDirector: false, ...partial };
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

// 1. Evento de redacción nace DRAFT
assert.equal(initialEventStatusForOrigin("REDACCION"), "DRAFT");
assert.equal(initialEventStatusForOrigin("CLF_IMPORT_FUTURE"), "DRAFT");

// 2. Evento público nace IN_REVIEW
assert.equal(initialEventStatusForOrigin("PUBLIC_INTAKE"), "IN_REVIEW");

// 3. DRAFT + SUBMIT_REVIEW → IN_REVIEW
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "DRAFT",
    action: "SUBMIT_REVIEW",
    actor: actor({}),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "IN_REVIEW");
}

// 4. IN_REVIEW + RETURN → DRAFT
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "IN_REVIEW",
    action: "RETURN",
    actor: actor({ isDirector: true, canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "DRAFT");
  const plan = planEventEditorialPersist(director, "IN_REVIEW", "RETURN");
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.plan.kind, "return");
    assert.equal(plan.plan.requiresObservation, true);
  }
}

// 5. IN_REVIEW + APPROVE → READY_TO_PUBLISH
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "IN_REVIEW",
    action: "APPROVE",
    actor: actor({ isDirector: true, canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "READY_TO_PUBLISH");
}

// 6. READY_TO_PUBLISH + PUBLISH → PUBLISHED
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "READY_TO_PUBLISH",
    action: "PUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "PUBLISHED");
}

// 7. Publicación directa por actor autorizado desde DRAFT
{
  const plan = planEventEditorialPersist(director, "DRAFT", "PUBLISH");
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.plan.kind, "standard");
    assert.equal(plan.plan.status, "PUBLISHED");
  }
  const redactor = planEventEditorialPersist(redactorDirect, "DRAFT", "PUBLISH");
  assert.equal(redactor.ok, true);
  if (redactor.ok) assert.equal(redactor.plan.status, "PUBLISHED");
}

// 8. Sin permiso → submit_via_publish
{
  const plan = planEventEditorialPersist(colaborador, "DRAFT", "PUBLISH");
  assert.equal(plan.ok, true);
  if (plan.ok) {
    assert.equal(plan.plan.kind, "submit_via_publish");
    assert.equal(plan.plan.status, "IN_REVIEW");
  }
}

// 9. PUBLISHED + UNPUBLISH → UNPUBLISHED
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "PUBLISHED",
    action: "UNPUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "UNPUBLISHED");
}

// 10. UNPUBLISHED + PUBLISH → PUBLISHED
{
  const r = resolveEditorialTransition({
    contentType: "EVENT",
    from: "UNPUBLISHED",
    action: "PUBLISH",
    actor: actor({ canPublish: true }),
  });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.targetStatus, "PUBLISHED");
}

// 11. ARCHIVE → ARCHIVED
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
      contentType: "EVENT",
      from,
      action: "ARCHIVE",
      actor: actor({}),
    });
    assert.equal(r.ok, true, `ARCHIVE from ${from}`);
    if (r.ok) assert.equal(r.targetStatus, "ARCHIVED");
  }
}

// 12. Transiciones inválidas desde ARCHIVED
{
  for (const action of [
    "SUBMIT_REVIEW",
    "RETURN",
    "APPROVE",
    "PUBLISH",
    "UNPUBLISH",
    "ARCHIVE",
  ] as const) {
    const r = canPerformEditorialTransition({
      contentType: "EVENT",
      from: "ARCHIVED",
      action,
      actor: actor({ canPublish: true, isDirector: true }),
    });
    assert.equal(r.ok, false, `ARCHIVED + ${action}`);
  }
}

// 13. Checklist bloquea publicación incompleta
{
  const err = validateEventForPublish({
    title: "Ab",
    description: "corto",
    organizerName: "X",
    city: "",
    province: "",
    slug: "",
  });
  assert.ok(err && err.includes("Faltan"));
  const ok = validateEventForPublish({
    title: "Maratón local",
    description: "Descripción suficientemente larga del evento deportivo.",
    organizerName: "Club Atlético",
    startAt: new Date(),
    city: "Rosario",
    province: "Santa Fe",
    slug: "maraton-local",
    contentTag: "REAL",
    latitude: -32.9442,
    longitude: -60.6505,
    locationConfirmedAt: new Date(),
    geocodingStatus: "CONFIRMED",
  });
  assert.equal(ok, null);

  const noGeo = validateEventForPublish({
    title: "Maratón local",
    description: "Descripción suficientemente larga del evento deportivo.",
    organizerName: "Club Atlético",
    startAt: new Date(),
    city: "Rosario",
    province: "Santa Fe",
    slug: "maraton-local",
    contentTag: "REAL",
  });
  assert.ok(noGeo && noGeo.includes("Georreferenciación"));
}

// 14. Público solo PUBLISHED + REAL — documentado vía filtro canónico
{
  const publicWhere = { status: "PUBLISHED" as const, contentTag: "REAL" as const };
  assert.equal(publicWhere.status, "PUBLISHED");
  assert.equal(publicWhere.contentTag, "REAL");
  assert.notEqual("UNPUBLISHED", publicWhere.status);
}

// 15 / 16. Migración semántica
assert.equal(mapLegacyEventStatus("PENDING_REVIEW"), "IN_REVIEW");
assert.equal(mapLegacyEventStatus("REJECTED"), "DRAFT");
assert.equal(mapLegacyEventStatus("PUBLISHED"), "PUBLISHED");
assert.equal(mapLegacyEventStatus("ARCHIVED"), "ARCHIVED");

// 17. Permisos por rol
assert.equal(canPerformEventEditorialAction(colaborador, "DRAFT", "PUBLISH").ok, true);
assert.equal(canPerformEventEditorialAction(colaborador, "READY_TO_PUBLISH", "PUBLISH").ok, false);
assert.equal(canPerformEventEditorialAction(director, "IN_REVIEW", "RETURN").ok, true);
assert.equal(canPerformEventEditorialAction(colaborador, "IN_REVIEW", "RETURN").ok, false);
assert.equal(canPerformEventEditorialAction(redactorDirect, "DRAFT", "PUBLISH").ok, true);

// 18. Wrappers antiguos = mismas transiciones (reject→RETURN, publish→PUBLISH)
{
  const rejectPlan = planEventEditorialPersist(director, "IN_REVIEW", "RETURN");
  assert.equal(rejectPlan.ok, true);
  if (rejectPlan.ok) assert.equal(rejectPlan.plan.status, "DRAFT");

  const publishPlan = planEventEditorialPersist(director, "IN_REVIEW", "PUBLISH");
  assert.equal(publishPlan.ok, true);
  if (publishPlan.ok) assert.equal(publishPlan.plan.status, "PUBLISHED");

  const archivePlan = planEventEditorialPersist(director, "PUBLISHED", "ARCHIVE");
  assert.equal(archivePlan.ok, true);
  if (archivePlan.ok) assert.equal(archivePlan.plan.status, "ARCHIVED");
}

assert.equal(EVENT_STATUS_LABELS.PUBLISHED, "Publicado");
assert.equal(
  hasPendingEventReturn({
    status: "DRAFT",
    returnedAt: new Date("2026-02-01"),
    submittedForReviewAt: new Date("2026-01-01"),
  }),
  true,
);

console.log("event-editorial-workflow tests: ok");
