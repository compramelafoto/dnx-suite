import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { looksLikeRawStatusEnum } from "@/lib/public-ux/status-presentation";
import {
  JURY_ANONYMITY_NOTICE,
  JURY_UI_FORBIDDEN_IDENTITY_HINTS,
  TECHNICAL_VS_JURY_ADMIN,
  TECHNICAL_VS_JURY_JUROR,
  anonymousWorkAltText,
  anonymousWorkLabel,
  containsForbiddenJuryOpsJargon,
  formatJuryProgress,
  presentJuryActionLabel,
  presentJuryAssignmentStatus,
  presentJuryEvaluationStatus,
  presentJuryHandoffFromBatch,
  presentJuryInvitationStatus,
  presentPublicResultsStatus,
  presentResultBatchStatus,
  presentResultEntryStatus,
  presentScoreScaleHelp,
  presentScoringSessionStatus,
} from "./jury-results-status-presentation";
import { JURY_FORBIDDEN_IDENTITY_FIELDS } from "@/lib/technical-admission/anonymity";

const ROOT = join(process.cwd());

describe("jury / results status presentation", () => {
  it("presents invitation and assignment statuses in Spanish", () => {
    for (const status of ["SENT", "ACCEPTED", "REJECTED", "EXPIRED", "REVOKED"]) {
      const presented = presentJuryInvitationStatus(status);
      assert.equal(looksLikeRawStatusEnum(presented.label), false, status);
    }
    assert.equal(presentJuryInvitationStatus("SENT").label, "Invitación enviada");
    assert.equal(presentJuryAssignmentStatus("IN_PROGRESS").label, "Evaluación en curso");
    assert.equal(presentJuryAssignmentStatus("COMPLETED").label, "Evaluación completada");
  });

  it("presents evaluation statuses and differentiates lock from complete", () => {
    assert.equal(presentJuryEvaluationStatus("NOT_STARTED").label, "Evaluación pendiente");
    assert.equal(presentJuryEvaluationStatus("COMPLETED").complete, true);
    assert.equal(presentJuryEvaluationStatus("LOCKED").editable, false);
    assert.match(presentJuryEvaluationStatus("LOCKED").label, /cerrada/i);
    assert.match(presentJuryEvaluationStatus("CONFLICT_DECLARED").label, /conflicto/i);
  });

  it("differentiates preliminary vs published result batches", () => {
    const preliminary = presentResultBatchStatus("GENERATED");
    assert.match(preliminary.label, /preliminar/i);
    assert.equal(preliminary.publiclyVisible, false);

    const published = presentResultBatchStatus("PUBLISHED");
    assert.match(published.label, /publicad/i);
    assert.equal(published.publiclyVisible, true);

    const confirmed = presentResultBatchStatus("FINALIZED");
    assert.match(confirmed.label, /confirmad/i);
    assert.equal(confirmed.publiclyVisible, false);
  });

  it("does not label winners as official when preliminary", () => {
    const provisional = presentResultEntryStatus("WINNER", { preliminary: true });
    assert.match(provisional.label, /provisoria/i);
    assert.doesNotMatch(provisional.label, /^Ganadora$/);

    const final = presentResultEntryStatus("WINNER", { preliminary: false });
    assert.equal(final.label, "Ganadora");
  });

  it("explains ties without inventing rules", () => {
    const tied = presentResultEntryStatus("TIED");
    assert.match(tied.label, /empate/i);
    assert.match(tied.description, /mismas reglas|mismo resultado/i);
    assert.ok(tied.nextAction);
  });

  it("differentiates close evaluations from publish results", () => {
    assert.equal(presentJuryActionLabel("close_evaluations"), "Cerrar evaluaciones");
    assert.equal(presentJuryActionLabel("publish_results"), "Publicar resultados");
    assert.equal(presentJuryActionLabel("confirm_results"), "Confirmar resultados");
    assert.equal(presentJuryActionLabel("freeze_for_jury"), "Congelar para el jurado");
    assert.notEqual(
      presentJuryActionLabel("close_evaluations"),
      presentJuryActionLabel("publish_results"),
    );
  });

  it("presents scoring session closed without implying publication", () => {
    const closed = presentScoringSessionStatus("CLOSED");
    assert.match(closed.description, /no publica/i);
  });

  it("keeps anonymity helpers free of photographer identity", () => {
    assert.match(JURY_ANONYMITY_NOTICE, /identidad/i);
    assert.match(anonymousWorkLabel("CAT-1234"), /Obra CAT-1234/);
    assert.match(anonymousWorkAltText("CAT-1234"), /oculta/i);
    assert.doesNotMatch(anonymousWorkAltText("CAT-1234"), /Lucía|email|instagram/i);
    for (const field of JURY_UI_FORBIDDEN_IDENTITY_HINTS) {
      assert.ok((JURY_FORBIDDEN_IDENTITY_FIELDS as readonly string[]).includes(field));
    }
  });

  it("formats progress with counts", () => {
    const progress = formatJuryProgress(12, 30);
    assert.equal(progress.summary, "12 de 30 fotografías evaluadas");
    assert.equal(progress.pendingLabel, "18 pendientes");
    assert.equal(formatJuryProgress(30, 30).complete, true);
  });

  it("does not invent scale meaning beyond neutral help", () => {
    assert.match(presentScoreScaleHelp(1, 10), /escala definida/i);
    assert.doesNotMatch(presentScoreScaleHelp(1, 10), /excelente/);
  });

  it("separates technical validation from jury evaluation", () => {
    assert.match(TECHNICAL_VS_JURY_ADMIN, /admisión técnica/i);
    assert.match(TECHNICAL_VS_JURY_ADMIN, /jurado evalúa/i);
    assert.match(TECHNICAL_VS_JURY_JUROR, /validación técnica/i);
    assert.match(TECHNICAL_VS_JURY_JUROR, /artísticos/i);
  });

  it("presents public results statuses without raw enums", () => {
    for (const status of ["not_available", "pending", "partial", "published", "archived"]) {
      assert.equal(
        looksLikeRawStatusEnum(presentPublicResultsStatus(status).label),
        false,
        status,
      );
    }
    assert.equal(presentPublicResultsStatus("partial").publiclyVisible, false);
    assert.equal(presentPublicResultsStatus("published").publiclyVisible, true);
  });

  it("handoff freeze is not publish", () => {
    const frozen = presentJuryHandoffFromBatch("FROZEN");
    assert.match(frozen.description, /no publica/i);
    assert.match(frozen.label, /jurado/i);
  });

  it("flags forbidden jury jargon", () => {
    assert.equal(containsForbiddenJuryOpsJargon("Open the ballot"), true);
    assert.equal(containsForbiddenJuryOpsJargon("Evaluación pendiente"), false);
  });
});

describe("jury / results UI source contracts", () => {
  it("results placeholder differentiates published vs preliminary", () => {
    const page = readFileSync(
      join(ROOT, "components/marathon/MarathonResultsPlaceholder.tsx"),
      "utf8",
    );
    assert.match(page, /presentPublicResultsStatus/);
    assert.match(page, /resultado publicado|Resultados publicados|publicados/i);
    assert.match(page, /preliminar|parcial/i);
    assert.doesNotMatch(page, /resultsStatusLabels\[/);
  });

  it("jury marketing section mentions anonymity / technical vs artistic", () => {
    const page = readFileSync(join(ROOT, "components/marathon/MarathonJury.tsx"), "utf8");
    assert.match(page, /identidad/i);
    assert.match(page, /admisión técnica|criterios definidos/i);
  });

  it("admision page includes jury handoff and conflict copy", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/admision/page.tsx"),
      "utf8",
    );
    assert.match(page, /JuryHandoffCard/);
    assert.match(page, /CONFLICT_OF_INTEREST_COPY/);
    assert.match(page, /Congelar para el jurado|freeze_for_jury/);
    assert.match(page, /Publicar resultados|publish_results/);
  });

  it("edition page humanizes sync and adds handoff", () => {
    const page = readFileSync(
      join(ROOT, "app/admin/(panel)/ediciones/[editionId]/page.tsx"),
      "utf8",
    );
    assert.match(page, /JuryHandoffCard/);
    assert.match(page, /Volver a intentar el envío/);
    assert.match(page, /AdminTechnicalInfo/);
    assert.doesNotMatch(page, /Sync postpago durable/);
    assert.doesNotMatch(page, />Manual</);
    assert.doesNotMatch(page, /cuid del FotorankContest/);
  });

  it("does not modify anonymity builder or admission rules", () => {
    const anonymity = readFileSync(join(ROOT, "lib/technical-admission/anonymity.ts"), "utf8");
    const rules = readFileSync(join(ROOT, "lib/technical-admission/rules.ts"), "utf8");
    assert.match(anonymity, /buildAnonymousJuryCode/);
    assert.match(anonymity, /JURY_FORBIDDEN_IDENTITY_FIELDS/);
    assert.match(rules, /evaluateTechnicalAdmission/);
  });
});
