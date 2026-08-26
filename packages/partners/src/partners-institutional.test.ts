import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultDisplayTierForRole,
  groupPartnersForPublicDisplay,
  institutionalRoleFromParticipationType,
  normalizeInstitutionalFields,
  resolvePublicRoleLabel,
  sanitizePublicRoleLabel,
} from "./institutional";
import { createMemoryPartnersRepository } from "./memory-repository";
import { createPartnersService } from "./service";
import type { PublicPartnerDisplayItem } from "./institutional";
import type { PartnerActor } from "./types";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };

describe("institutional roles", () => {
  it("maps participationType without using money", () => {
    assert.equal(institutionalRoleFromParticipationType("MEDIA_PARTNER"), "MEDIA_PARTNER");
    assert.equal(institutionalRoleFromParticipationType("COLLABORATOR"), "COLLABORATOR");
    assert.equal(institutionalRoleFromParticipationType("SERVICE_PROVIDER"), "SUPPLIER");
    assert.equal(defaultDisplayTierForRole("ORGANIZER"), "INSTITUTIONAL");
    assert.equal(defaultDisplayTierForRole("MAIN_SPONSOR"), "MAIN");
  });

  it("sanitizes public labels and strips HTML", () => {
    assert.equal(sanitizePublicRoleLabel("  <b>Acompaña</b>  "), "Acompaña");
    assert.equal(resolvePublicRoleLabel("SPONSOR", "Con el apoyo de"), "Con el apoyo de");
    assert.equal(resolvePublicRoleLabel("SPONSOR", null), "Sponsor");
  });

  it("groups publicly and hides empty + SUPPLIER by default", () => {
    const items: PublicPartnerDisplayItem[] = [
      {
        participationId: "1",
        partnerId: "p1",
        partnerName: "SFPR",
        institutionalRole: "ORGANIZER",
        displayTier: "INSTITUTIONAL",
        displayOrder: 10,
        publicRoleLabel: null,
        resolvedRoleLabel: "Organizador",
        status: "ACTIVE",
        publicVisibility: "PUBLIC",
      },
      {
        participationId: "2",
        partnerId: "p2",
        partnerName: "Senado",
        institutionalRole: "ORGANIZER",
        displayTier: "INSTITUTIONAL",
        displayOrder: 20,
        publicRoleLabel: null,
        resolvedRoleLabel: "Organizador",
        status: "ACTIVE",
        publicVisibility: "PUBLIC",
      },
      {
        participationId: "3",
        partnerId: "p3",
        partnerName: "Lab X",
        institutionalRole: "SPONSOR",
        displayTier: "STANDARD",
        displayOrder: 100,
        publicRoleLabel: null,
        resolvedRoleLabel: "Sponsor",
        status: "ACTIVE",
        publicVisibility: "PUBLIC",
      },
      {
        participationId: "4",
        partnerId: "p4",
        partnerName: "Draft Co",
        institutionalRole: "SPONSOR",
        displayTier: "STANDARD",
        displayOrder: 1,
        publicRoleLabel: null,
        resolvedRoleLabel: "Sponsor",
        status: "DRAFT",
        publicVisibility: "HIDDEN",
      },
      {
        participationId: "5",
        partnerId: "p5",
        partnerName: "Printer",
        institutionalRole: "SUPPLIER",
        displayTier: "SUPPORTING",
        displayOrder: 1,
        publicRoleLabel: null,
        resolvedRoleLabel: "Proveedor",
        status: "ACTIVE",
        publicVisibility: "PUBLIC",
      },
      {
        participationId: "6",
        partnerId: "p6",
        partnerName: "Hidden Confirmed",
        institutionalRole: "COLLABORATOR",
        displayTier: "SUPPORTING",
        displayOrder: 1,
        publicRoleLabel: null,
        resolvedRoleLabel: "Colaborador",
        status: "CONFIRMED",
        publicVisibility: "HIDDEN",
      },
    ];
    const groups = groupPartnersForPublicDisplay(items);
    assert.equal(groups.length, 2);
    assert.equal(groups[0]?.heading, "Organizan");
    assert.equal(groups[0]?.items.length, 2);
    assert.equal(groups[0]?.items[0]?.partnerName, "SFPR");
    assert.equal(groups[1]?.heading, "Sponsors");
    assert.equal(groups[1]?.items.length, 1);
  });

  it("createParticipation stores institutional fields separately from contribution", async () => {
    const svc = createPartnersService(createMemoryPartnersRepository());
    const partner = await svc.createPartner(ops, { name: "Vicario Lab" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      institutionalRole: "COLLABORATOR",
      displayTier: "SUPPORTING",
      displayOrder: 40,
      publicRoleLabel: "Colaboran",
      requiresPayment: false,
      status: "ACTIVE",
    });
    assert.equal(participation.institutionalRole, "COLLABORATOR");
    assert.equal(participation.displayTier, "SUPPORTING");
    assert.equal(participation.displayOrder, 40);
    assert.equal(participation.publicRoleLabel, "Colaboran");
    assert.equal(participation.requiresPayment, false);
    assert.equal(participation.participationType, "COLLABORATOR");

    await svc.createContribution(ops, {
      participationId: participation.id,
      type: "VOUCHER",
      title: "2 vouchers",
      quantity: 2,
    });
    // Rol no cambia por aporte
    const listed = await svc.listParticipationsByContext(ops, {
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
    });
    assert.equal(listed[0]?.institutionalRole, "COLLABORATOR");
  });

  it("normalizeInstitutionalFields defaults tier from role", () => {
    const n = normalizeInstitutionalFields({ institutionalRole: "MAIN_SPONSOR" });
    assert.equal(n.displayTier, "MAIN");
    assert.equal(n.participationType, "SPONSOR");
    assert.equal(n.displayOrder, 100);
  });
});
