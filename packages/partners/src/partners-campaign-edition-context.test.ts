import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPartnerCampaignEligibleForEditionContext } from "./campaign-edition-context";

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
