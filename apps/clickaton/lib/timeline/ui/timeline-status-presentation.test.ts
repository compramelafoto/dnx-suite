import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  formatTimelineDateTime,
  presentAdminPromptStatus,
  presentAutomationExecutionStatus,
  presentMilestoneStatus,
  presentTimelineEventType,
  presentTimelineVersionStatus,
} from "./timeline-status-presentation";

const ROOT = join(process.cwd());

describe("timeline / prompt status labels", () => {
  it("presents DRAFT and ACTIVE without raw enums", () => {
    const draft = presentTimelineVersionStatus("DRAFT");
    assert.equal(draft.label, "Borrador");
    assert.equal(looksLikeRawStatusEnum(draft.label), false);
    assert.equal(draft.visibleToParticipants, false);

    const active = presentTimelineVersionStatus("ACTIVE");
    assert.equal(active.label, "Cronograma publicado");
    assert.equal(looksLikeRawStatusEnum(active.label), false);
  });

  it("presents prompt statuses in Spanish", () => {
    assert.equal(presentAdminPromptStatus("DRAFT").label, "En preparación");
    assert.equal(presentAdminPromptStatus("LOCKED").label, "Programada · oculta");
    assert.equal(presentAdminPromptStatus("RELEASED").label, "Disponible para participantes");
    assert.equal(presentAdminPromptStatus("CLOSED").label, "Finalizada");
    for (const s of ["DRAFT", "READY", "LOCKED", "RELEASED", "CLOSED", "CANCELLED"]) {
      assert.equal(looksLikeRawStatusEnum(presentAdminPromptStatus(s).label), false, s);
    }
  });

  it("presents failed automations with next step", () => {
    const failed = presentAutomationExecutionStatus("FAILED");
    assert.match(failed.label, /no se pudo/i);
    assert.ok(failed.nextAction);
  });

  it("formats dates for Argentina", () => {
    const formatted = formatTimelineDateTime(
      new Date("2026-09-19T19:00:00.000Z"),
      "America/Argentina/Buenos_Aires",
    );
    assert.match(formatted, /septiembre/i);
    assert.doesNotMatch(formatted, /T19:00:00/);
  });

  it("maps event types to human labels", () => {
    assert.match(presentTimelineEventType("PROMPT_RELEASE").label, /consigna/i);
    assert.match(presentTimelineEventType("ACCREDITATION_OPEN").label, /acreditación/i);
  });

  it("maps milestone statuses", () => {
    assert.equal(presentMilestoneStatus("UPCOMING").label, "Programada");
    assert.equal(presentMilestoneStatus("OPEN").label, "En curso");
    assert.equal(presentMilestoneStatus("PENDING_CONFIG").label, "Sin horario definido");
  });
});

describe("timeline UI source contracts", () => {
  it("cronograma page removes DRAFT jargon and Asegurar DRAFT", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/cronograma/page.tsx"),
      "utf8",
    );
    assert.match(page, /Cronograma de la edición/);
    assert.match(page, /Crear borrador de cronograma/);
    assert.match(page, /Publicar cronograma/);
    assert.match(page, /Próxima actividad/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.doesNotMatch(page, /Asegurar DRAFT/);
    assert.doesNotMatch(page, /Desplazar futuros → nueva DRAFT/);
    assert.doesNotMatch(page, />Activar versión</);
    assert.doesNotMatch(page, />serverNow</);
    assert.doesNotMatch(page, /Timezone:/);
  });

  it("consignas page differentiates save vs publish and hides enums", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/consignas/page.tsx"),
      "utf8",
    );
    assert.match(page, /Consignas de la edición/);
    assert.match(page, /Guardar cambios/);
    assert.match(page, /Publicar ahora/);
    assert.match(page, /En preparación/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.doesNotMatch(page, />DRAFT</);
    assert.doesNotMatch(page, />LOCKED</);
    assert.doesNotMatch(page, /Liberar consigna ahora/);
    assert.doesNotMatch(page, /Payload LOCKED/);
    assert.doesNotMatch(page, /JSON\.stringify\(lockedPreview,\s*null,\s*2\)/);
  });

  it("confirm button requires confirmation for sensitive actions", () => {
    const btn = readFileSync(
      join(ROOT, "components/admin/ConfirmSubmitButton.tsx"),
      "utf8",
    );
    assert.match(btn, /window\.confirm/);
    assert.match(btn, /type="submit"/);
  });
});
