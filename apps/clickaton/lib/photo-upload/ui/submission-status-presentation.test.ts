import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  buildValidationChecklist,
  containsForbiddenSubmissionOpsJargon,
  deriveSubmissionOperationalSummary,
  formatSubmissionDateTime,
  presentAdminReviewActionLabel,
  presentFailureOrCaptureReason,
  presentFotoRankLink,
  presentMimeAsFormat,
  presentSubmissionStatus,
  presentValidationResult,
} from "./submission-status-presentation";
import {
  presentAdmissionReasonCode,
  presentAdmissionStatus,
  presentBatchStatus,
} from "@/lib/technical-admission/ui/admission-status-presentation";

const ROOT = join(process.cwd());

describe("submission / admission status labels", () => {
  it("presents submission statuses in Spanish without raw enums", () => {
    for (const status of [
      "PENDING_CONFIRMATION",
      "CONFIRMED",
      "REJECTED",
      "FAILED",
      "PROCESSING",
      "READY_FOR_REVIEW",
      "WITHDRAWN",
      "REPLACED",
    ]) {
      const presented = presentSubmissionStatus(status);
      assert.equal(looksLikeRawStatusEnum(presented.label), false, status);
      assert.ok(presented.description.length > 10);
    }
    assert.equal(presentSubmissionStatus("CONFIRMED").label, "Aceptada técnicamente");
    assert.match(presentSubmissionStatus("CONFIRMED").description, /jurado/i);
  });

  it("presents validation results without PASS/FAIL as labels", () => {
    assert.equal(presentValidationResult("PASS").label, "Cumple requisitos técnicos");
    assert.equal(presentValidationResult("FAIL").label, "No cumple los requisitos técnicos");
    assert.equal(presentValidationResult("MANUAL_REVIEW").label, "Requiere revisión técnica");
    assert.equal(looksLikeRawStatusEnum(presentValidationResult("WARNING").label), false);
  });

  it("humanizes capture and duplicate reasons", () => {
    const capture = presentFailureOrCaptureReason("CAPTURE_OUTSIDE_WINDOW");
    assert.ok(capture);
    assert.match(capture.title, /fecha de captura/i);
    assert.doesNotMatch(capture.title, /CAPTURE_OUTSIDE/);
    assert.equal(capture.legalReview, true);

    const dup = presentFailureOrCaptureReason("DUPLICATE_SAME_PROMPT");
    assert.ok(dup);
    assert.match(dup.title, /duplicada/i);
    assert.doesNotMatch(dup.adminExplanation, /SHA|fingerprint/i);
  });

  it("presents MIME as human format", () => {
    assert.equal(presentMimeAsFormat("image/jpeg"), "JPEG");
    assert.equal(presentMimeAsFormat("image/png"), "PNG");
    assert.doesNotMatch(presentMimeAsFormat("image/jpeg"), /image\//);
  });

  it("differentiates capture vs delivery date formatting", () => {
    const formatted = formatSubmissionDateTime(
      new Date("2026-09-19T19:00:00.000Z"),
      "America/Argentina/Buenos_Aires",
    );
    assert.match(formatted, /septiembre/i);
    assert.doesNotMatch(formatted, /T19:00:00/);
  });

  it("presents FotoRank as a process stage", () => {
    const linked = presentFotoRankLink({
      fotorankEntryId: "entry_1",
      status: "CONFIRMED",
    });
    assert.match(linked.label, /FotoRank/i);
    assert.match(linked.description, /evaluación/i);

    const missing = presentFotoRankLink({
      fotorankEntryId: null,
      status: "CONFIRMED",
    });
    assert.match(missing.label, /Pendiente/i);
  });

  it("derives operational summary without persisting new states", () => {
    const ready = deriveSubmissionOperationalSummary({
      status: "CONFIRMED",
      validationResult: "PASS",
      fotorankEntryId: "x",
    });
    assert.equal(ready.key, "ready_to_continue");
    assert.match(ready.label, /Lista para continuar/i);

    const review = deriveSubmissionOperationalSummary({
      status: "PENDING_CONFIRMATION",
      validationResult: "MANUAL_REVIEW",
    });
    assert.equal(review.key, "needs_review");

    const bad = deriveSubmissionOperationalSummary({
      status: "REJECTED",
      validationResult: "FAIL",
    });
    assert.equal(bad.key, "does_not_meet");
  });

  it("builds checklist from existing fields only", () => {
    const items = buildValidationChecklist({
      status: "CONFIRMED",
      validationResult: "PASS",
      captureDateInterpreted: new Date(),
      createdAt: new Date(),
      hasOriginal: true,
      technicalSummary: {
        mime: "image/jpeg",
        width: 4000,
        height: 3000,
        captureEval: { result: "PASS", reason: "WITHIN_CAPTURE_WINDOW" },
        duplicate: { scope: "NONE" },
      },
    });
    assert.ok(items.length >= 6);
    assert.ok(items.every((item) => !looksLikeRawStatusEnum(item.label)));
  });

  it("renames admin review actions", () => {
    assert.equal(presentAdminReviewActionLabel("APPROVE"), "Aceptar técnicamente");
    assert.equal(presentAdminReviewActionLabel("REJECT"), "Marcar como no válida");
    assert.equal(presentAdminReviewActionLabel("MANUAL_REVIEW"), "Solicitar revisión");
  });

  it("presents admission statuses and reasons in Spanish", () => {
    assert.equal(presentAdmissionStatus("ADMITTED").label, "Aceptada técnicamente");
    assert.match(presentAdmissionStatus("ADMITTED").description, /jurado|finalista/i);
    assert.equal(presentAdmissionStatus("FROZEN_FOR_JURY").label, "Lista para el jurado");
    assert.equal(looksLikeRawStatusEnum(presentBatchStatus("DRAFT").label), false);

    const reason = presentAdmissionReasonCode("DUPLICATE_BLOCKING");
    assert.match(reason.title, /duplicada/i);
    assert.equal(reason.legalReview, true);
  });

  it("flags forbidden ops jargon helpers", () => {
    assert.equal(containsForbiddenSubmissionOpsJargon("Revisá EXIF y MIME"), true);
    assert.equal(containsForbiddenSubmissionOpsJargon("Fecha de captura válida"), false);
  });
});

describe("submissions / admission UI source contracts", () => {
  it("envios page hides raw ops jargon and uses confirmations", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/envios/page.tsx"),
      "utf8",
    );
    assert.match(page, /Entregas fotográficas/);
    assert.match(page, /Aceptar técnicamente|presentAdminReviewActionLabel\("APPROVE"\)/);
    assert.match(page, /Marcar como no válida|presentAdminReviewActionLabel\("REJECT"\)/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.match(page, /ValidationChecklist/);
    assert.match(page, /SubmissionFiltersPanel/);
    assert.match(page, /Fecha de captura/);
    assert.match(page, /Fecha de entrega/);
    assert.match(page, /Envío a FotoRank/);
    assert.match(page, /md:block/);
    assert.match(page, /hidden overflow-x-auto md:block/);
    assert.doesNotMatch(page, />Aprobar técnicamente</);
    assert.doesNotMatch(page, />Rechazar</);
    assert.doesNotMatch(page, />Cola revisión</);
    assert.doesNotMatch(page, /hash \{/);
    assert.doesNotMatch(page, /EXIF:/);
    assert.doesNotMatch(page, /entry \{/);
    assert.doesNotMatch(page, /Asegurar config upload/);
    assert.doesNotMatch(page, />PENDING_CONFIRMATION</);
    assert.doesNotMatch(page, />MANUAL_REVIEW</);
  });

  it("admision page separates technical validation from jury", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/admision/page.tsx"),
      "utf8",
    );
    const presentation = readFileSync(
      join(ROOT, "lib/technical-admission/ui/admission-status-presentation.ts"),
      "utf8",
    );
    assert.match(page, /Admisión técnica/);
    assert.match(page, /TECHNICAL_VALIDATION_DISCLAIMER/);
    assert.match(presentation, /no determina si la fotografía será finalista/i);
    assert.match(page, /Evaluar y aceptar técnicamente/);
    assert.match(page, /Congelar para el jurado/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.match(page, /ConfirmSubmitButton/);
    assert.match(page, /Sin vínculo FotoRank/);
    assert.doesNotMatch(page, /Sin entry FR/);
    assert.doesNotMatch(page, /Crear \/ obtener lote DRAFT/);
    assert.doesNotMatch(page, /Reabrir \(no frozen\)/);
    assert.doesNotMatch(page, />serverNow</);
    assert.doesNotMatch(page, /<strong>\{d\.status\}<\/strong>/);
  });

  it("does not modify validators or admission rules modules", () => {
    const windows = readFileSync(join(ROOT, "lib/photo-upload/windows.ts"), "utf8");
    const rules = readFileSync(join(ROOT, "lib/technical-admission/rules.ts"), "utf8");
    assert.match(windows, /evaluateCaptureDate/);
    assert.match(rules, /evaluateTechnicalAdmission|publicReasonForStatus/);
  });
});
