import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertParticipationPublicPublishable,
  createMemoryPartnersRepository,
  createPartnersService,
  groupPartnersForPublicDisplay,
  PartnersDomainError,
  resolvePartnerLogoAdminState,
  resolvePartnerPublicationAdminState,
} from "./index";

const ops = { userId: 1, isOpsAdmin: true as const };

describe("partner public visibility", () => {
  it("new confirmed participation defaults to HIDDEN and stays off landing", async () => {
    const svc = createPartnersService(createMemoryPartnersRepository());
    const partner = await svc.createPartner(ops, {
      name: "Sliders Test",
      status: "ACTIVE",
      type: "COMPANY",
    });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      institutionalRole: "COLLABORATOR",
      status: "CONFIRMED",
      requiresPayment: false,
    });
    assert.equal(participation.publicVisibility, "HIDDEN");
    assert.equal(participation.requiresPayment, false);

    const groups = groupPartnersForPublicDisplay([
      {
        participationId: participation.id,
        partnerId: partner.id,
        partnerName: partner.name,
        institutionalRole: "COLLABORATOR",
        displayTier: "SUPPORTING",
        displayOrder: 100,
        publicRoleLabel: null,
        resolvedRoleLabel: "Colaborador",
        status: "CONFIRMED",
        publicVisibility: participation.publicVisibility,
      },
    ]);
    assert.equal(groups.length, 0);
  });

  it("prospect partner has no confirmed participation side effects", async () => {
    const svc = createPartnersService(createMemoryPartnersRepository());
    const partner = await svc.createPartner(ops, {
      name: "Tecnoflash Prospect",
      status: "PROSPECT",
    });
    assert.equal(partner.status, "PROSPECT");
    const listed = await svc.listParticipations(ops, partner.id);
    assert.equal(listed.length, 0);
  });

  it("publish requires approved logo for commercial partners", async () => {
    const svc = createPartnersService(createMemoryPartnersRepository());
    const partner = await svc.createPartner(ops, {
      name: "Multi Shop Pub",
      status: "ACTIVE",
      type: "COMPANY",
    });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      institutionalRole: "COLLABORATOR",
      status: "CONFIRMED",
    });

    await assert.rejects(
      () => svc.publishParticipation(ops, participation.id),
      (err: unknown) => err instanceof PartnersDomainError,
    );

    const asset = await svc.createPartnerAsset(ops, {
      partnerId: partner.id,
      type: "LOGO_PRIMARY",
      name: "Logo",
      storageKey: "clickaton/partners/x/brand/2026-08-07/a.png",
      fileUrl: "/api/media/clickaton/partners/x/brand/2026-08-07/a.png",
      isPrimary: true,
      status: "DRAFT",
      approvalStatus: "PENDING",
    });
    await svc.approvePartnerAsset(ops, asset.id);
    const published = await svc.publishParticipation(ops, participation.id);
    assert.equal(published.publicVisibility, "PUBLIC");

    const hidden = await svc.unpublishParticipation(ops, participation.id);
    assert.equal(hidden.publicVisibility, "HIDDEN");
  });

  it("admin logo/publication state helpers", () => {
    assert.equal(
      resolvePartnerLogoAdminState({
        hasUsableApprovedLogo: false,
        hasUploadedLogo: false,
      }),
      "PENDING",
    );
    assert.equal(
      resolvePartnerPublicationAdminState({
        publicVisibility: "HIDDEN",
        participationStatus: "CONFIRMED",
        logoState: "APPROVED",
        partnerType: "COMPANY",
      }),
      "READY",
    );
    assert.doesNotThrow(() =>
      assertParticipationPublicPublishable({
        status: "CONFIRMED",
        partnerType: "PERSON",
        hasApprovedLogo: false,
      }),
    );
  });
});
