import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPartnerCampaignEligibleForContestContext,
  isPartnerCampaignEligibleForEditionContext,
  isPartnerCampaignEligibleForScopeContext,
} from "./campaign-edition-context";

describe("campaign edition context (Clickatón welcome)", () => {
  const editionA = "edition-rosario";
  const editionB = "edition-cordoba";

  it("campaña global (sin participación) aparece en cualquier edición", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: null,
      }),
      true,
    );
  });

  it("participación EDITION de la edición actual aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: editionA,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
  });

  it("participación de otra edición no aparece (sin fallback)", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: editionB,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
  });

  it("participación FotoRank / otra app no aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "FOTO_RANK",
          contextType: "EDITION",
          contextId: editionA,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
  });

  it("participación GLOBAL/PLATFORM aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
  });

  it("participación cancelada/archivada no aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: editionA,
          status: "CANCELLED",
          archivedAt: null,
        },
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: editionA,
          status: "ACTIVE",
          archivedAt: new Date(),
        },
      }),
      false,
    );
  });

  it("contextos no-edition (CATEGORY) no se usan como fallback", () => {
    assert.equal(
      isPartnerCampaignEligibleForEditionContext({
        editionId: editionA,
        participation: {
          application: "CLICKATON",
          contextType: "CATEGORY",
          contextId: "cat-1",
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
  });
});

describe("campaign contest context (FotoRank welcome)", () => {
  const contestA = "contest-sfef";
  const contestB = "contest-other";

  it("null participation NO es global en FotoRank (evita huérfanas)", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: null,
      }),
      false,
    );
  });

  it("GLOBAL/PLATFORM explícito aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "GLOBAL",
          contextId: null,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      true,
    );
  });

  it("CONTEST del concurso actual aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
      true,
    );
  });

  it("otro concurso no aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestB,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
      false,
    );
  });

  it("Clickatón / InfoSpot / CLF / FotoOffice no aparecen", () => {
    for (const application of [
      "CLICKATON",
      "INFO_SPOT",
      "COMPRAME_LA_FOTO",
      "FOTO_OFFICE",
    ] as const) {
      assert.equal(
        isPartnerCampaignEligibleForContestContext({
          contestId: contestA,
          participation: {
            application,
            contextType: "CONTEST",
            contextId: contestA,
            status: "ACTIVE",
            archivedAt: null,
            publicVisibility: "PUBLIC",
          },
        }),
        false,
        application,
      );
    }
  });

  it("participación HIDDEN / no-ACTIVE / vencida no aparece", () => {
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "HIDDEN",
        },
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "CANCELLED",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "COMPLETED",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
      false,
    );
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "DRAFT",
          archivedAt: null,
          publicVisibility: "PUBLIC",
        },
      }),
      false,
    );
    const now = new Date("2026-08-12T12:00:00Z");
    assert.equal(
      isPartnerCampaignEligibleForContestContext({
        contestId: contestA,
        now,
        participation: {
          application: "FOTO_RANK",
          contextType: "CONTEST",
          contextId: contestA,
          status: "ACTIVE",
          archivedAt: null,
          publicVisibility: "PUBLIC",
          endsAt: new Date("2026-08-01T00:00:00Z"),
        },
      }),
      false,
    );
  });

  it("scope genérico admite CONTEST y rechaza EDITION cruzado", () => {
    assert.equal(
      isPartnerCampaignEligibleForScopeContext({
        application: "FOTO_RANK",
        scopeKind: "CONTEST",
        scopeId: contestA,
        treatNullParticipationAsGlobal: false,
        participation: {
          application: "FOTO_RANK",
          contextType: "EDITION",
          contextId: contestA,
          status: "ACTIVE",
          archivedAt: null,
        },
      }),
      false,
    );
  });
});
