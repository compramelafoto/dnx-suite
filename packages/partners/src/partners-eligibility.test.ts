import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAutomaticAccessKey,
  buildBenefitAccessSyncPlan,
  buildManualAccessKey,
  canUserAccessBenefit,
  createMemoryPartnersRepository,
  createPartnersService,
  evaluateBenefitEligibility,
  getBenefitAccessExplanation,
  listAccessibleBenefitsForUser,
  normalizeEligibilityEmail,
  summarizeSyncPlan,
  type BenefitForEligibility,
  type ClickatonEligibilitySnapshot,
  type PartnerActor,
} from "./index";

const ops: PartnerActor = { userId: 1, isOpsAdmin: true };

function emptySnapshot(
  overrides: Partial<ClickatonEligibilitySnapshot> = {},
): ClickatonEligibilitySnapshot {
  return {
    editionId: "ed1",
    registrations: [],
    winners: [],
    finalists: [],
    knownUserIds: new Set(),
    emailToUserId: new Map(),
    ...overrides,
  };
}

function benefit(overrides: Partial<BenefitForEligibility> = {}): BenefitForEligibility {
  return {
    id: "ben1",
    partnerId: "p1",
    participationId: "part1",
    status: "ACTIVE",
    startsAt: null,
    endsAt: null,
    archivedAt: null,
    audiences: [],
    ...overrides,
  };
}

describe("eligibility — audiencias Clickatón", () => {
  it("participantes de edición (activos)", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([10]),
      registrations: [
        {
          registrationId: "r1",
          editionId: "ed1",
          userId: 10,
          email: "a@x.com",
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          categoryIds: [],
          cancelled: false,
        },
        {
          registrationId: "r2",
          editionId: "ed1",
          userId: 11,
          email: null,
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          categoryIds: [],
          cancelled: true,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: { clickatonAudienceKey: "EDITION_PARTICIPANTS" },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.userId, 10);
    assert.equal(evaluation.materializableSubjects[0]?.reasonCode, "EDITION_PARTICIPANT");
  });

  it("participantes confirmados", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([10, 20]),
      registrations: [
        {
          registrationId: "r1",
          editionId: "ed1",
          userId: 10,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: [],
          cancelled: false,
        },
        {
          registrationId: "r2",
          editionId: "ed1",
          userId: 20,
          email: null,
          status: "PENDING_PAYMENT",
          paymentStatus: "PENDING",
          categoryIds: [],
          cancelled: false,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "CONFIRMED_REGISTRATION",
            metadata: { clickatonAudienceKey: "CONFIRMED_REGISTRATION" },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.reasonCode, "CONFIRMED_EDITION_PARTICIPANT");
  });

  it("compradores (proxy) — no incluye participante sin pago", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([10, 20]),
      registrations: [
        {
          registrationId: "r-buy",
          editionId: "ed1",
          userId: 10,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: [],
          cancelled: false,
        },
        {
          registrationId: "r-part",
          editionId: "ed1",
          userId: 20,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "PENDING",
          categoryIds: [],
          cancelled: false,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "PRODUCT_PURCHASERS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: { clickatonAudienceKey: "PRODUCT_PURCHASERS" },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.userId, 10);
    assert.equal(evaluation.materializableSubjects[0]?.reasonCode, "EDITION_PURCHASER");
  });

  it("categoría competitiva", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([10, 20]),
      registrations: [
        {
          registrationId: "r1",
          editionId: "ed1",
          userId: 10,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: ["cat-a"],
          cancelled: false,
        },
        {
          registrationId: "r2",
          editionId: "ed1",
          userId: 20,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: ["cat-b"],
          cancelled: false,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "CATEGORY",
            metadata: { clickatonAudienceKey: "CATEGORY", categoryId: "cat-a" },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.userId, 10);
  });

  it("ganadores", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([99]),
      winners: [
        {
          registrationId: "rw",
          assignmentId: "as1",
          prizeBundleId: "bundle-1",
          categoryId: "cat-w",
          winnerVersion: 1,
          userId: 99,
          email: null,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "WINNERS",
            metadata: { clickatonAudienceKey: "WINNERS" },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects[0]?.reasonCode, "WINNER");
    assert.equal(evaluation.materializableSubjects[0]?.sourceType, "CLICKATON_PRIZE_ASSIGNMENT");
  });

  it("PRIZE_BUNDLE_WINNERS filtra por metadata.prizeBundleId", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([11, 22]),
      winners: [
        {
          registrationId: "r1",
          assignmentId: "as-a",
          prizeBundleId: "bundle-a",
          categoryId: "cat-1",
          winnerVersion: 1,
          userId: 11,
          email: null,
        },
        {
          registrationId: "r2",
          assignmentId: "as-b",
          prizeBundleId: "bundle-b",
          categoryId: "cat-2",
          winnerVersion: 1,
          userId: 22,
          email: null,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "PRIZE_BUNDLE_WINNERS",
            metadata: {
              clickatonAudienceKey: "PRIZE_BUNDLE_WINNERS",
              prizeBundleId: "bundle-a",
            },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.userId, 11);
    assert.equal(evaluation.materializableSubjects[0]?.audienceKey, "PRIZE_BUNDLE_WINNERS");
  });

  it("CATEGORY_WINNERS filtra por metadata.categoryId", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([11, 22]),
      winners: [
        {
          registrationId: "r1",
          assignmentId: "as-a",
          prizeBundleId: "bundle-a",
          categoryId: "cat-1",
          winnerVersion: 2,
          userId: 11,
          email: null,
        },
        {
          registrationId: "r2",
          assignmentId: "as-b",
          prizeBundleId: "bundle-b",
          categoryId: "cat-2",
          winnerVersion: 1,
          userId: 22,
          email: null,
        },
      ],
    });
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "CATEGORY_WINNERS",
            metadata: {
              clickatonAudienceKey: "CATEGORY_WINNERS",
              categoryId: "cat-2",
            },
          },
        ],
      }),
      snapshot,
    });
    assert.equal(evaluation.materializableSubjects.length, 1);
    assert.equal(evaluation.materializableSubjects[0]?.userId, 22);
    assert.equal(evaluation.materializableSubjects[0]?.audienceKey, "CATEGORY_WINNERS");
  });

  it("finalistas sin fuente → no evaluable", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "FINALISTS",
            metadata: { clickatonAudienceKey: "FINALISTS" },
          },
        ],
      }),
      snapshot: emptySnapshot(),
    });
    assert.equal(evaluation.notEvaluableAudiences.length, 1);
    assert.equal(evaluation.materializableSubjects.length, 0);
  });

  it("usuario manual en audiencia", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "MANUAL_USERS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: 7,
            label: null,
            metadata: null,
          },
        ],
      }),
      snapshot: emptySnapshot({ knownUserIds: new Set([7]) }),
    });
    assert.equal(evaluation.materializableSubjects[0]?.userId, 7);
    assert.equal(evaluation.materializableSubjects[0]?.reasonCode, "MANUAL_USER");
  });

  it("ALL_USERS / STAFF no evaluables", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "ALL_USERS",
            contextType: null,
            contextId: null,
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
          {
            id: "a2",
            audienceType: "CUSTOM_GROUP",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: "STAFF",
            metadata: { clickatonAudienceKey: "STAFF" },
          },
        ],
      }),
      snapshot: emptySnapshot(),
    });
    assert.equal(evaluation.notEvaluableAudiences.length, 2);
  });

  it("beneficio pausado / vencido no materializa", () => {
    const snapshot = emptySnapshot({
      knownUserIds: new Set([10]),
      registrations: [
        {
          registrationId: "r1",
          editionId: "ed1",
          userId: 10,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: [],
          cancelled: false,
        },
      ],
    });
    const audiences = [
      {
        id: "a1",
        audienceType: "EDITION_PARTICIPANTS" as const,
        contextType: "EDITION",
        contextId: "ed1",
        organizationId: null,
        manualUserId: null,
        label: null,
        metadata: null,
      },
    ];
    const paused = evaluateBenefitEligibility({
      benefit: benefit({ status: "PAUSED", audiences }),
      snapshot,
    });
    assert.equal(paused.benefitActive, false);
    const plan = buildBenefitAccessSyncPlan({
      benefit: benefit({ status: "PAUSED", audiences }),
      snapshot,
      existingAccess: [],
      mode: "PREVIEW",
    });
    assert.equal(plan.toGrant.length, 0);

    const expired = evaluateBenefitEligibility({
      benefit: benefit({
        audiences,
        endsAt: new Date("2020-01-01"),
      }),
      snapshot,
      now: new Date("2026-01-01"),
    });
    assert.equal(expired.withinWindow, false);
  });
});

describe("eligibility — identidad", () => {
  it("userId canónico materializa", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
        ],
      }),
      snapshot: emptySnapshot({
        knownUserIds: new Set([5]),
        registrations: [
          {
            registrationId: "r1",
            editionId: "ed1",
            userId: 5,
            email: null,
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            categoryIds: [],
            cancelled: false,
          },
        ],
      }),
    });
    assert.equal(evaluation.materializableSubjects[0]?.materializable, true);
  });

  it("email exacto normalizado resuelve identidad", () => {
    assert.equal(normalizeEligibilityEmail("  Foo@Bar.COM "), "foo@bar.com");
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
        ],
      }),
      snapshot: emptySnapshot({
        knownUserIds: new Set([42]),
        emailToUserId: new Map([["guest@x.com", 42]]),
        registrations: [
          {
            registrationId: "r1",
            editionId: "ed1",
            userId: null,
            email: "guest@x.com",
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            categoryIds: [],
            cancelled: false,
          },
        ],
      }),
    });
    assert.equal(evaluation.materializableSubjects[0]?.userId, 42);
  });

  it("sin identidad → pending, no inventa user", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
        ],
      }),
      snapshot: emptySnapshot({
        registrations: [
          {
            registrationId: "r1",
            editionId: "ed1",
            userId: null,
            email: "orphan@x.com",
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            categoryIds: [],
            cancelled: false,
          },
        ],
      }),
    });
    assert.equal(evaluation.pendingIdentity.length, 1);
    assert.equal(evaluation.pendingIdentity[0]?.reasonCode, "MISSING_CANONICAL_USER");
    assert.equal(evaluation.materializableSubjects.length, 0);
  });

  it("no asocia por nombre/instagram (solo userId o email map)", () => {
    const evaluation = evaluateBenefitEligibility({
      benefit: benefit({
        audiences: [
          {
            id: "a1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
        ],
      }),
      snapshot: emptySnapshot({
        knownUserIds: new Set([1]),
        registrations: [
          {
            registrationId: "r1",
            editionId: "ed1",
            userId: null,
            email: null,
            status: "CONFIRMED",
            paymentStatus: "APPROVED",
            categoryIds: [],
            cancelled: false,
          },
        ],
      }),
    });
    assert.equal(evaluation.materializableSubjects.length, 0);
    assert.equal(evaluation.pendingIdentity[0]?.userId, null);
  });
});

describe("eligibility — materialización / sync plan", () => {
  it("preview planifica grants sin side-effects en repo", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Acme Sync", slug: "acme-sync" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed1",
      participationType: "SPONSOR",
    });
    const ben = await svc.createBenefit(ops, {
      partnerId: partner.id,
      participationId: participation.id,
      title: "Kit",
      description: "Desc",
      benefitType: "OTHER",
      redemptionMethod: "OTHER",
    });
    await svc.activateBenefit(ops, ben.id);

    const snapshot = emptySnapshot({
      knownUserIds: new Set([10]),
      registrations: [
        {
          registrationId: "r1",
          editionId: "ed1",
          userId: 10,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: [],
          cancelled: false,
        },
      ],
    });
    const plan = buildBenefitAccessSyncPlan({
      benefit: {
        id: ben.id,
        partnerId: partner.id,
        participationId: participation.id,
        status: "ACTIVE",
        startsAt: null,
        endsAt: null,
        archivedAt: null,
        audiences: [
          {
            id: "aud1",
            audienceType: "EDITION_PARTICIPANTS",
            contextType: "EDITION",
            contextId: "ed1",
            organizationId: null,
            manualUserId: null,
            label: null,
            metadata: null,
          },
        ],
      },
      snapshot,
      existingAccess: [],
      mode: "PREVIEW",
    });
    assert.equal(plan.mode, "PREVIEW");
    assert.equal(plan.toGrant.length, 1);
    assert.equal((await svc.listBenefitAccess(ops, ben.id)).length, 0);
    assert.equal(summarizeSyncPlan(plan).toGrant, 1);
  });

  it("apply idempotente: no duplica; mantiene manual; revoca automático ineligible", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Acme 2", slug: "acme-2" });
    const { participation } = await svc.createParticipation(ops, {
      partnerId: partner.id,
      application: "CLICKATON",
      contextType: "EDITION",
      contextId: "ed1",
      participationType: "SPONSOR",
    });
    const ben = await svc.createBenefit(ops, {
      partnerId: partner.id,
      participationId: participation.id,
      title: "Kit",
      description: "Desc",
      benefitType: "OTHER",
      redemptionMethod: "OTHER",
    });
    await svc.activateBenefit(ops, ben.id);

    const benefitShape: BenefitForEligibility = {
      id: ben.id,
      partnerId: partner.id,
      participationId: participation.id,
      status: "ACTIVE",
      startsAt: null,
      endsAt: null,
      archivedAt: null,
      audiences: [
        {
          id: "aud1",
          audienceType: "EDITION_PARTICIPANTS",
          contextType: "EDITION",
          contextId: "ed1",
          organizationId: null,
          manualUserId: null,
          label: null,
          metadata: null,
        },
      ],
    };

    const snapWith = (userIds: number[]) =>
      emptySnapshot({
        knownUserIds: new Set(userIds),
        registrations: userIds.map((uid) => ({
          registrationId: `r-${uid}`,
          editionId: "ed1",
          userId: uid,
          email: null,
          status: "CONFIRMED",
          paymentStatus: "APPROVED",
          categoryIds: [],
          cancelled: false,
        })),
      });

    const plan1 = buildBenefitAccessSyncPlan({
      benefit: benefitShape,
      snapshot: snapWith([10, 11]),
      existingAccess: [],
      mode: "APPLY",
    });
    for (const g of plan1.toGrant) {
      await svc.grantBenefitAccess(ops, {
        benefitId: ben.id,
        userId: g.userId!,
        source: "AUTOMATIC",
        sourceType: g.sourceType,
        sourceId: g.sourceId,
        reasonCode: g.reasonCode,
        accessKey: g.accessKey,
      });
    }
    const manual = await svc.grantBenefitAccess(ops, {
      benefitId: ben.id,
      userId: 99,
      source: "MANUAL",
      reason: "Cortesía VIP",
    });
    assert.equal(manual.source, "MANUAL");

    const afterFirst = await svc.listBenefitAccess(ops, ben.id);
    assert.equal(afterFirst.filter((a) => a.status === "ACTIVE").length, 3);

    const plan2 = buildBenefitAccessSyncPlan({
      benefit: benefitShape,
      snapshot: snapWith([10]),
      existingAccess: afterFirst,
      mode: "APPLY",
    });
    assert.equal(plan2.toGrant.length, 0);
    assert.equal(plan2.toKeep.length, 1);
    assert.equal(plan2.toRevoke.length, 1);
    assert.equal(plan2.toRevoke[0]?.userId, 11);
    // Manual no entra en toRevoke
    assert.ok(!plan2.toRevoke.some((r) => r.accessKey === buildManualAccessKey(ben.id, 99)));

    for (const r of plan2.toRevoke) {
      await svc.revokeBenefitAccessByAccessKey(ops, r.accessKey);
    }
    const afterRevoke = await svc.listBenefitAccess(ops, ben.id);
    assert.ok(
      afterRevoke.some((a) => a.userId === 99 && a.status === "ACTIVE" && a.source === "MANUAL"),
    );
    assert.ok(
      afterRevoke.some((a) => a.userId === 11 && a.status === "REVOKED" && a.source === "AUTOMATIC"),
    );

    // Re-sync: keep 10, no duplicate
    const plan3 = buildBenefitAccessSyncPlan({
      benefit: benefitShape,
      snapshot: snapWith([10]),
      existingAccess: afterRevoke,
      mode: "APPLY",
    });
    assert.equal(plan3.toGrant.length, 0);
    assert.equal(plan3.toKeep.length, 1);
  });

  it("accessKey automático es estable", () => {
    const k1 = buildAutomaticAccessKey({
      benefitId: "b",
      userId: 1,
      sourceType: "CLICKATON_REGISTRATION",
      sourceId: "r1",
    });
    const k2 = buildAutomaticAccessKey({
      benefitId: "b",
      userId: 1,
      sourceType: "CLICKATON_REGISTRATION",
      sourceId: "r1",
    });
    assert.equal(k1, k2);
    assert.equal(k1, "auto:b:1:CLICKATON_REGISTRATION:r1");
  });
});

describe("eligibility — consulta efectiva", () => {
  it("manual / automático / revocado / beneficio vencido", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "Q", slug: "q-elig" });
    const ben = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "B",
      description: "D",
      benefitType: "OTHER",
      redemptionMethod: "OTHER",
      endsAt: new Date("2030-01-01"),
    });
    await svc.activateBenefit(ops, ben.id);
    await svc.grantBenefitAccess(ops, {
      benefitId: ben.id,
      userId: 1,
      source: "MANUAL",
      reason: "VIP",
    });
    await svc.grantBenefitAccess(ops, {
      benefitId: ben.id,
      userId: 2,
      source: "AUTOMATIC",
      sourceType: "CLICKATON_REGISTRATION",
      sourceId: "r2",
      reasonCode: "EDITION_PARTICIPANT",
      accessKey: buildAutomaticAccessKey({
        benefitId: ben.id,
        userId: 2,
        sourceType: "CLICKATON_REGISTRATION",
        sourceId: "r2",
      }),
    });
    await svc.revokeBenefitAccessByAccessKey(
      ops,
      buildAutomaticAccessKey({
        benefitId: ben.id,
        userId: 2,
        sourceType: "CLICKATON_REGISTRATION",
        sourceId: "r2",
      }),
    );

    const accesses = await svc.listBenefitAccess(ops, ben.id);
    const benefitRecord = (await svc.listBenefits(ops, partner.id)).find((b) => b.id === ben.id);
    assert.ok(benefitRecord);

    const manual = canUserAccessBenefit({
      benefit: benefitRecord,
      accesses,
      userId: 1,
    });
    assert.equal(manual.hasAccess, true);
    assert.ok(manual.sources.includes("MANUAL"));

    const revoked = getBenefitAccessExplanation({
      benefit: benefitRecord,
      accesses,
      userId: 2,
    });
    assert.equal(revoked.hasAccess, false);
    assert.match(revoked.explanation, /revocado/i);

    const expiredBenefit = {
      ...benefitRecord,
      endsAt: new Date("2020-01-01"),
    };
    const expiredAccess = canUserAccessBenefit({
      benefit: expiredBenefit,
      accesses,
      userId: 1,
      now: new Date("2026-01-01"),
    });
    assert.equal(expiredAccess.hasAccess, false);

    const list = listAccessibleBenefitsForUser({
      benefits: [benefitRecord],
      accessesByBenefitId: new Map([[ben.id, accesses]]),
      userId: 1,
    });
    assert.equal(list.length, 1);
  });
});

describe("eligibility — permisos", () => {
  it("preview/sync capabilities existen en ops admin", () => {
    assert.ok(ops.isOpsAdmin);
  });

  it("grant manual exige motivo", async () => {
    const repo = createMemoryPartnersRepository();
    const svc = createPartnersService(repo);
    const partner = await svc.createPartner(ops, { name: "R", slug: "r-elig" });
    const ben = await svc.createBenefit(ops, {
      partnerId: partner.id,
      title: "B",
      description: "D",
      benefitType: "OTHER",
      redemptionMethod: "OTHER",
    });
    await assert.rejects(
      () => svc.grantBenefitAccess(ops, { benefitId: ben.id, userId: 3, source: "MANUAL" }),
      /motivo/i,
    );
  });
});
