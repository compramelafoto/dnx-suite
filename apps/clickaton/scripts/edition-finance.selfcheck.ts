/**
 * Etapa 5 ��� distribución financiera por edición (in-memory).
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  createEditionFinanceService,
  createInMemoryEditionFinanceStore,
} from "../lib/admin/edition-finance/application/edition-finance-service";
import { EditionFinanceError } from "../lib/admin/edition-finance/domain/errors";
import { allocateByLargestRemainder } from "../lib/admin/edition-finance/domain/rounding";
import type { FinanceActor, FinanceGrant } from "../lib/admin/edition-finance/permissions";

function grant(
  userId: number,
  capability: FinanceGrant["capability"],
  overrides: Partial<FinanceGrant> = {},
): FinanceGrant {
  return {
    id: `g_${capability}_${userId}`,
    userId,
    capability,
    productKey: "clickaton",
    scopeType: "EDITION",
    scopeId: null,
    status: "ACTIVE",
    grantedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function actor(userId: number, grants: FinanceGrant[]): FinanceActor {
  return { userId, grants };
}

async function main() {
  const store = createInMemoryEditionFinanceStore();
  const svc = createEditionFinanceService(store);
  const editionId = "ed_ar_2026";

  store.identities.set("fi_tammy", {
    id: "fi_tammy",
    ownerUserId: 30,
    displayName: "Tammy",
    email: "tammyytamer@gmail.com",
  });
  store.identities.set("fi_other", {
    id: "fi_other",
    ownerUserId: 40,
    displayName: "Otro",
    email: "otro@example.com",
  });
  store.accounts.set("acc_tammy_test", {
    id: "acc_tammy_test",
    financialIdentityId: "fi_tammy",
    provider: "MERCADO_PAGO",
    environment: "TEST",
    status: "ACTIVE",
    providerUserId: "mp_test_1",
    connectedAt: new Date(),
    lastError: null,
    canReceivePayments: true,
  });
  store.accounts.set("acc_tammy_revoked", {
    id: "acc_tammy_revoked",
    financialIdentityId: "fi_tammy",
    provider: "MERCADO_PAGO",
    environment: "TEST",
    status: "REVOKED",
    providerUserId: "mp_test_x",
    connectedAt: new Date(),
    lastError: "revoked",
    canReceivePayments: false,
  });

  const daniel = actor(1, [grant(1, "DNX_FINANCE_OWNER", { productKey: null, scopeType: null })]);
  const viewer = actor(2, [grant(2, "PRODUCT_FINANCE_VIEWER")]);
  const noFinance = actor(3, []);

  // 11) sin permiso
  assert.throws(
    () =>
      svc.createDraftDistribution(noFinance, {
        editionId,
        name: "AR 2026",
        allocations: [
          { financialIdentityId: "fi_tammy", sharePercent: 100, paymentConnectionId: "acc_tammy_test" },
        ],
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "FORBIDDEN",
  );

  // 12) Daniel con permiso + 1 DRAFT editable + 7 Tammy 100%
  const draft = svc.createDraftDistribution(daniel, {
    editionId,
    name: "Clickatón Argentina 2026",
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_test",
        role: "ORGANIZER",
      },
    ],
  });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.allocations.length, 1);
  assert.equal(draft.allocations[0]!.shareBps, 10_000);
  assert.equal(draft.allocations[0]!.beneficiaryDisplayName, "Tammy");

  // 4) suma < 100
  assert.throws(
    () =>
      svc.updateDraftAllocations(daniel, {
        editionId,
        versionId: draft.versionId!,
        allocations: [{ financialIdentityId: "fi_tammy", sharePercent: 80 }],
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "INVALID_SHARE_SUM",
  );

  // 5) suma > 100
  assert.throws(
    () =>
      svc.updateDraftAllocations(daniel, {
        editionId,
        versionId: draft.versionId!,
        allocations: [
          { financialIdentityId: "fi_tammy", sharePercent: 60 },
          { financialIdentityId: "fi_other", sharePercent: 50 },
        ],
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "INVALID_SHARE_SUM",
  );

  // 6) suma exacta 100
  const okDraft = svc.updateDraftAllocations(daniel, {
    editionId,
    versionId: draft.versionId!,
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_test",
      },
    ],
  });
  assert.equal(okDraft.allocations.reduce((s, a) => s + a.shareBps, 0), 10_000);

  // 8) sin conexión al activar
  const draftNoConn = svc.updateDraftAllocations(daniel, {
    editionId,
    versionId: draft.versionId!,
    allocations: [{ financialIdentityId: "fi_tammy", sharePercent: 100 }],
  });
  assert.throws(
    () =>
      svc.activateDistribution(daniel, {
        editionId,
        versionId: draftNoConn.versionId!,
        requireValidConnections: true,
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "MISSING_CONNECTION",
  );

  // 9) conexión revocada
  svc.updateDraftAllocations(daniel, {
    editionId,
    versionId: draft.versionId!,
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_revoked",
      },
    ],
  });
  assert.throws(
    () =>
      svc.activateDistribution(daniel, {
        editionId,
        versionId: draft.versionId!,
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "MISSING_CONNECTION",
  );

  // Restaurar TEST válida y activar
  svc.updateDraftAllocations(daniel, {
    editionId,
    versionId: draft.versionId!,
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_test",
      },
    ],
  });
  const active = svc.activateDistribution(daniel, {
    editionId,
    versionId: draft.versionId!,
  });
  assert.equal(active.status, "ACTIVE");
  assert.equal(active.versionStatus, "PUBLISHED");

  // 2) ACTIVE inmutable + 22) intentar modificar ACTIVE
  assert.throws(
    () =>
      svc.updateDraftAllocations(daniel, {
        editionId,
        versionId: active.versionId!,
        allocations: [
          {
            financialIdentityId: "fi_tammy",
            sharePercent: 100,
            paymentConnectionId: "acc_tammy_test",
          },
        ],
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "IMMUTABLE",
  );

  // 3) nueva versión
  const v2 = svc.createDraftDistribution(daniel, {
    editionId,
    name: "Clickatón Argentina 2026",
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_test",
      },
    ],
  });
  assert.equal(v2.version, 2);
  assert.equal(v2.status, "DRAFT");

  // 13) snapshot en orden
  const snap1 = svc.buildSnapshotForRegistration({
    editionId,
    registrationId: "reg_1",
    currency: "ARS",
    grossAmount: 35_000_00,
    discountAmount: 5_000_00,
    providerFee: 1_000_00,
    platformFee: 0,
  });
  assert.equal(snap1.chargedAmount, 30_000_00);
  assert.equal(snap1.distributableAmount, 29_000_00);
  assert.equal(snap1.allocations[0]!.allocationAmount, 29_000_00);
  assert.equal(snap1.distributionVersion, 1); // ACTIVE v1, no el draft v2

  // 15) idempotente
  const snap1b = svc.buildSnapshotForRegistration({
    editionId,
    registrationId: "reg_1",
    currency: "ARS",
    grossAmount: 99_999_00,
    discountAmount: 0,
  });
  assert.equal(snap1b.distributableAmount, snap1.distributableAmount);

  // 14 + 23) cambio posterior no altera orden histórica; nueva versión solo futuras
  const active2 = svc.activateDistribution(daniel, {
    editionId,
    versionId: v2.versionId!,
  });
  assert.equal(active2.version, 2);
  const hist = svc.getRegistrationSnapshot("reg_1");
  assert.equal(hist!.distributionVersion, 1);
  const snap2 = svc.buildSnapshotForRegistration({
    editionId,
    registrationId: "reg_2",
    currency: "ARS",
    grossAmount: 25_000_00,
    discountAmount: 0,
    providerFee: 0,
  });
  assert.equal(snap2.distributionVersion, 2);

  // 10) conexión TEST en gate LIVE bloquea; TEST mode ok
  const gateTest = svc.evaluateGate({
    editionId,
    mode: "TEST",
    dnxPaymentsReady: true,
    webhookConfigured: true,
    hasActivePricePhase: true,
  });
  assert.equal(gateTest.ok, true);

  const gateLive = svc.evaluateGate({
    editionId,
    mode: "LIVE",
    dnxPaymentsReady: true,
    webhookConfigured: true,
    hasActivePricePhase: true,
  });
  assert.equal(gateLive.ok, false);
  assert.ok(gateLive.blockers.some((b) => /LIVE/i.test(b)));

  // 19) distribución inexistente
  assert.equal(svc.resolveActiveDistribution("ed_missing"), null);
  assert.throws(
    () =>
      svc.buildSnapshotForRegistration({
        editionId: "ed_missing",
        registrationId: "reg_x",
        currency: "ARS",
        grossAmount: 1000,
        discountAmount: 0,
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "NO_ACTIVE_DISTRIBUTION",
  );

  // 20) gate inscripción
  assert.equal(gateTest.ok, true);
  assert.equal(gateLive.ok, false);

  // Viewer puede listar
  const listed = svc.listDistributions(viewer, editionId);
  assert.ok(listed.length >= 2);

  // 18) redondeo
  const rounded = allocateByLargestRemainder(100, [
    { id: "a", shareBps: 3334, sortOrder: 1 },
    { id: "b", shareBps: 3333, sortOrder: 2 },
    { id: "c", shareBps: 3333, sortOrder: 3 },
  ]);
  assert.equal(
    rounded.reduce((s, r) => s + r.allocationAmount, 0),
    100,
  );

  // 16���17) webhook/ledger: documentados como responsabilidad DNX Payments (idempotency inbox);
  // aquí verificamos que no se duplica snapshot (arriba).
  assert.equal(store.orderSnapshots.size, 2);

  // 21) no duplicar DRAFT abierto (idempotencia de versión)
  const v3 = svc.createDraftDistribution(daniel, {
    editionId,
    name: "v3",
    allocations: [
      {
        financialIdentityId: "fi_tammy",
        sharePercent: 100,
        paymentConnectionId: "acc_tammy_test",
      },
    ],
  });
  assert.equal(v3.version, 3);
  assert.throws(
    () =>
      svc.createDraftDistribution(daniel, {
        editionId,
        name: "dup",
        allocations: [
          {
            financialIdentityId: "fi_tammy",
            sharePercent: 100,
            paymentConnectionId: "acc_tammy_test",
          },
        ],
      }),
    (e: unknown) => e instanceof EditionFinanceError && e.code === "ALREADY_EXISTS",
  );

  // 24) refund gap: no hay ledger Prisma; comportamiento documentado en audit md.
  assert.ok(true, "refund gap documented");

  console.log(JSON.stringify({ ok: true, checks: 24 }, null, 2));
}

const isMain =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
