import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PartnersDomainError,
  assertNoAutomaticPaymentSideEffects,
  assertPartnerCapability,
  createMemoryPartnersRepositoryWithAudit,
  createPartnersService,
  normalizePaymentFields,
  type PartnerActor,
} from "./index";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };
const viewer: PartnerActor = { userId: 2, capabilities: ["PARTNER_VIEW"] };

function service() {
  const repo = createMemoryPartnersRepositoryWithAudit();
  return { svc: createPartnersService(repo), repo };
}

describe("permissions", () => {
  it("ops admin has partner capabilities", () => {
    assert.doesNotThrow(() => assertPartnerCapability(ops, "PARTNER_CREATE"));
  });
  it("viewer cannot create", () => {
    assert.throws(
      () => assertPartnerCapability(viewer, "PARTNER_CREATE"),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "FORBIDDEN",
    );
  });
});

describe("partner CRUD", () => {
  it("creates partner with slug from name", async () => {
    const { svc } = service();
    const p = await svc.createPartner(ops, { name: "Tecnoflash" });
    assert.equal(p.name, "Tecnoflash");
    assert.equal(p.slug, "tecnoflash");
    assert.equal(p.status, "PROSPECT");
  });

  it("archives partner without hard delete", async () => {
    const { svc } = service();
    const p = await svc.createPartner(ops, { name: "Vicario" });
    const archived = await svc.archivePartner(ops, p.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.ok(archived.archivedAt);
  });
});

describe("participation without payment", () => {
  it("creates participation with requiresPayment=false by default", async () => {
    const { svc, repo } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    const { participation, paymentSideEffects } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "FOTO_OFFICE",
      participationType: "BENEFIT_PROVIDER",
      title: "Beneficios SFPR + Clickatón",
      contextType: "ORGANIZATION",
      organizationId: "sfpr",
    });
    assert.equal(participation.requiresPayment, false);
    assert.equal(participation.paymentMode, "NONE");
    assert.equal(participation.paymentAmountMinor, null);
    assert.deepEqual(paymentSideEffects, {
      createdPaymentOrder: false,
      createdPaymentLink: false,
      createdRecurringSchedule: false,
    });
    const audits = repo.getAuditEvents();
    assert.ok(audits.some((a) => a.action === "participation.create"));
  });

  it("normalizePaymentFields clears amounts when no payment", () => {
    const fields = normalizePaymentFields({
      requiresPayment: false,
      paymentMode: "RECURRING",
      paymentAmountMinor: 9999,
    });
    assert.equal(fields.requiresPayment, false);
    assert.equal(fields.paymentMode, "NONE");
    assert.equal(fields.paymentAmountMinor, null);
  });
});

describe("participation with optional payment", () => {
  it("stores manual payment terms without side effects", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    const { participation, paymentSideEffects } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      participationType: "SPONSOR",
      contextType: "EDITION",
      contextId: "ed-2026",
      requiresPayment: true,
      paymentMode: "ONE_TIME",
      paymentAmountMinor: 500_000,
      paymentCurrency: "ARS",
      paymentNotes: "Acuerdo manual — sin link MP",
    });
    assert.equal(participation.requiresPayment, true);
    assert.equal(participation.paymentMode, "ONE_TIME");
    assert.equal(participation.paymentAmountMinor, 500_000);
    assert.deepEqual(
      assertNoAutomaticPaymentSideEffects(participation),
      paymentSideEffects,
    );
    assert.equal(paymentSideEffects.createdPaymentOrder, false);
    assert.equal(paymentSideEffects.createdPaymentLink, false);
    assert.equal(paymentSideEffects.createdRecurringSchedule, false);
  });
});

describe("contributions", () => {
  it("allows contribution without economic value", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
    });
    const c = await svc.createContribution(ops, {
      participationId: participation.id,
      type: "SERVICE",
      title: "Descuento en limpieza de sensores",
      description: "Para participantes Clickatón",
    });
    assert.equal(c.estimatedTotalValueMinor, null);
    assert.equal(c.type, "SERVICE");
  });

  it("supports prize and voucher types", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Comercio X" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed1",
      participationType: "PRIZE_PROVIDER",
    });
    const prize = await svc.createContribution(ops, {
      participationId: participation.id,
      type: "PRIZE",
      title: "Kit impresión",
    });
    const voucher = await svc.createContribution(ops, {
      participationId: participation.id,
      type: "VOUCHER",
      title: "Voucher $10.000",
      externalCode: "VOUCHER-DEMO",
    });
    assert.equal(prize.type, "PRIZE");
    assert.equal(voucher.type, "VOUCHER");
    const delivered = await svc.markContributionDelivered(ops, prize.id);
    assert.equal(delivered.status, "DELIVERED");
    assert.ok(delivered.deliveredAt);
  });
});

describe("benefits", () => {
  it("creates benefit with and without promo code", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Vicario" });
    const withCode = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Código Sony 10%",
      description: "Descuento en tienda",
      benefitType: "PROMO_CODE",
      promoCode: "SONY10",
      redemptionMethod: "PROMO_CODE",
    });
    const withoutCode = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Limpieza gratuita",
      description: "Presentar credencial",
      benefitType: "FREE_SERVICE",
      redemptionMethod: "PHYSICAL_CREDENTIAL",
    });
    assert.equal(withCode.promoCode, "SONY10");
    assert.equal(withoutCode.promoCode, null);
  });

  it("assigns organization and event audiences", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Desc. reparaciones socios",
      description: "10% en servicio técnico",
      benefitType: "PERCENTAGE_DISCOUNT",
      discountPercentage: 10,
      redemptionMethod: "IDENTITY_VERIFICATION",
    });
    const orgAud = await svc.assignAudience(ops, {
      benefitId: benefit.id,
      audienceType: "ORGANIZATION_MEMBERS",
      organizationId: "sfpr",
    });
    const eventAud = await svc.assignAudience(ops, {
      benefitId: benefit.id,
      audienceType: "EVENT_PARTICIPANTS",
      contextType: "EDITION",
      contextId: "clickaton-2026",
    });
    assert.equal(orgAud.audienceType, "ORGANIZATION_MEMBERS");
    assert.equal(eventAud.audienceType, "EVENT_PARTICIPANTS");
  });

  it("requires title, description and method to activate", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Beneficio incompleto",
      benefitType: "OTHER",
      redemptionMethod: "OTHER",
    });
    await assert.rejects(
      () => svc.activateBenefit(ops, benefit.id),
      (err: unknown) =>
        err instanceof PartnersDomainError &&
        err.code === "VALIDATION" &&
        Boolean(err.fieldErrors.description),
    );
  });

  it("activates and pauses with publish capability", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Vicario" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Limpieza",
      description: "Una limpieza de sensor",
      benefitType: "FREE_SERVICE",
      redemptionMethod: "MANUAL_APPROVAL",
    });
    const active = await svc.activateBenefit(ops, benefit.id);
    assert.equal(active.status, "ACTIVE");
    const paused = await svc.pauseBenefit(ops, benefit.id);
    assert.equal(paused.status, "PAUSED");
  });
});

describe("validations", () => {
  it("rejects invalid date range on participation", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    await assert.rejects(
      () =>
        svc.createParticipation(ops, {
          partnerId: partner.id,
          application: "FOTO_RANK",
          startsAt: new Date("2026-12-01"),
          endsAt: new Date("2026-01-01"),
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "VALIDATION",
    );
  });

  it("rejects discount percentage out of range", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    await assert.rejects(
      () =>
        svc.createBenefit(ops, {
          partnerId: partner.id,
          title: "Bad %",
          description: "x",
          benefitType: "PERCENTAGE_DISCOUNT",
          discountPercentage: 150,
          redemptionMethod: "PROMO_CODE",
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "VALIDATION",
    );
  });

  it("rejects negative redemption limits", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    await assert.rejects(
      () =>
        svc.createBenefit(ops, {
          partnerId: partner.id,
          title: "Bad limit",
          description: "x",
          benefitType: "VOUCHER",
          totalRedemptionLimit: -1,
          redemptionMethod: "PROMO_CODE",
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "VALIDATION",
    );
  });
});

describe("forbidden without grants", () => {
  it("blocks create for viewer", async () => {
    const { svc } = service();
    await assert.rejects(
      () => svc.createPartner(viewer, { name: "X" }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "FORBIDDEN",
    );
  });

  it("blocks payment fields without PARTNER_PAYMENTS_MANAGE", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    const noPay: PartnerActor = {
      userId: 9,
      capabilities: ["PARTNER_VIEW", "PARTNER_PARTICIPATIONS_MANAGE"],
    };
    await assert.rejects(
      () =>
        svc.createParticipation(noPay, {
          partnerId: partner.id,
          application: "CLICKATON",
          requiresPayment: true,
          paymentAmountMinor: 1000,
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "FORBIDDEN",
    );
  });
});

describe("edition context (stage 02)", () => {
  it("lists participations by edition context", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-2026",
      participationType: "SPONSOR",
    });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-other",
      participationType: "COLLABORATOR",
      allowDuplicateActive: true,
    });
    const listed = await svc.listParticipationsByContext(ops, {
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-2026",
    });
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.contextId, "ed-2026");
  });

  it("warns on duplicate active participation without allow flag", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      participationType: "PRIZE_PROVIDER",
    });
    await assert.rejects(
      () =>
        svc.createParticipation(ops, {
          partnerId: partner.id,
          application: "CLICKATON",
          contextType: "EDITION",
          contextId: "ed-1",
          participationType: "PRIZE_PROVIDER",
        }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "CONFLICT",
    );
  });

  it("links contribution to prize bundle soft-id", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Lab" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      participationType: "PRIZE_PROVIDER",
    });
    const c = await svc.createContribution(ops, {
      participationId: participation.id,
      type: "PRIZE",
      title: "Cámara",
    });
    const linked = await svc.linkContributionToPrize(ops, c.id, "prize-bundle-1");
    assert.equal(linked.prizeBundleId, "prize-bundle-1");
    const byPrize = await svc.listContributionsByPrizeBundle(ops, "prize-bundle-1");
    assert.equal(byPrize.length, 1);
  });

  it("archives participation", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Media" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed-1",
      participationType: "MEDIA_PARTNER",
    });
    const archived = await svc.archiveParticipation(ops, participation.id);
    assert.equal(archived.status, "ARCHIVED");
    assert.ok(archived.archivedAt);
  });

  it("rejects activating expired benefit", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Vicario" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Vencido",
      description: "Ya no vale",
      benefitType: "VOUCHER",
      redemptionMethod: "PROMO_CODE",
      endsAt: new Date("2020-01-01"),
    });
    await assert.rejects(
      () => svc.activateBenefit(ops, benefit.id),
      (err: unknown) =>
        err instanceof PartnersDomainError &&
        err.code === "VALIDATION" &&
        Boolean(err.fieldErrors.endsAt),
    );
  });

  it("grants and revokes manual benefit access without duplicates", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Sony" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "Cortesía",
      description: "Acceso manual",
      benefitType: "OTHER",
      redemptionMethod: "MANUAL_APPROVAL",
    });
    const access = await svc.grantBenefitAccess(ops, {
      benefitId: benefit.id,
      userId: 42,
      notes: "Cortesía staff",
    });
    assert.equal(access.status, "ACTIVE");
    assert.equal(access.userId, 42);
    await assert.rejects(
      () => svc.grantBenefitAccess(ops, { benefitId: benefit.id, userId: 42 }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "CONFLICT",
    );
    await assert.rejects(
      () => svc.grantBenefitAccess(ops, { benefitId: benefit.id, userId: 0 }),
      (err: unknown) => err instanceof PartnersDomainError && err.code === "VALIDATION",
    );
    const revoked = await svc.revokeBenefitAccess(ops, benefit.id, 42);
    assert.equal(revoked.status, "REVOKED");
  });

  it("assigns clickaton-style audiences including buyers and confirmed", async () => {
    const { svc } = service();
    const partner = await svc.createPartner(ops, { name: "Tecnoflash" });
    const benefit = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "20% reparaciones",
      description: "Para inscriptos",
      benefitType: "PERCENTAGE_DISCOUNT",
      discountPercentage: 20,
      redemptionMethod: "IDENTITY_VERIFICATION",
    });
    const all = await svc.assignAudience(ops, {
      benefitId: benefit.id,
      audienceType: "EDITION_PARTICIPANTS",
      contextType: "EDITION",
      contextId: "ed-1",
    });
    const buyers = await svc.assignAudience(ops, {
      benefitId: benefit.id,
      audienceType: "PRODUCT_PURCHASERS",
      contextType: "EDITION",
      contextId: "ed-1",
      label: "Compradores de inscripción",
    });
    const confirmed = await svc.assignAudience(ops, {
      benefitId: benefit.id,
      audienceType: "CUSTOM_GROUP",
      contextType: "EDITION",
      contextId: "ed-1",
      label: "CONFIRMED_REGISTRATION",
      metadata: { clickatonAudienceKey: "CONFIRMED_REGISTRATION" },
    });
    assert.equal(all.audienceType, "EDITION_PARTICIPANTS");
    assert.equal(buyers.audienceType, "PRODUCT_PURCHASERS");
    assert.equal(confirmed.label, "CONFIRMED_REGISTRATION");
  });
});
