/**
 * Clickatón staging partners economic agreement (10D3I-E).
 * Pure domain orchestration — no Prisma, no Mercado Pago HTTP.
 */
import { calculateDistribution } from "../distribution/calculate.js";
import {
  canPerformFinanceAction,
  type FinanceActor,
  type FinanceGrant,
} from "../finance-permissions/index.js";
import type { FinancialDomainStore } from "../financial-identity/memory-store.js";
import type { FinancialIdentityService } from "../financial-identity/service.js";
import type { PaymentAccount } from "../financial-identity/types.js";
import {
  distributionRulesToEngineInput,
  financialIdentityToRecipientDraft,
  paymentAccountToProviderAccountDraft,
} from "../bridges/to-dnx-payments.js";
import { money } from "../money/index.js";
import { EconomicAgreementService } from "./service.js";
import type {
  AgreementParticipant,
  DistributionVersion,
  EconomicAgreement,
  OrderDistributionSnapshot,
} from "./types.js";

export const CLICKATON_PARTNERS_AGREEMENT = {
  productKey: "clickaton",
  scopeType: "STAGING_TEST",
  scopeId: "partners-10d3i-e",
  name: "Clickatón — Acuerdo socios TEST",
  countryCode: "AR",
  currency: "ARS",
} as const;

export const CLICKATON_PARTNERS_BPS = {
  dani: 3400,
  rodri: 3300,
  tammy: 3300,
} as const;

export const CLICKATON_PARTNERS_MP_IDS = {
  dani: "TEST_E10_DANI",
  rodri: "TEST_E10_RODRI",
  tammy: "TEST_E10_TAMMY",
} as const;

export type PartnerKey = "dani" | "rodri" | "tammy";

export interface PartnerUserRef {
  key: PartnerKey;
  userId: number;
  legalName: string;
}

export interface ConfigureClickatonPartnersInput {
  store: FinancialDomainStore;
  identities: FinancialIdentityService;
  agreements: EconomicAgreementService;
  partners: {
    dani: PartnerUserRef;
    rodri: PartnerUserRef;
    tammy: PartnerUserRef;
  };
  /** Explicit finance grants loaded for actors (never derived from email). */
  grantsByUserId: Map<number, FinanceGrant[]>;
  /** Optional credential refs already minted (vault ids). */
  credentialRefs?: Partial<Record<PartnerKey, string>>;
  totalMinorForSnapshot?: bigint;
  externalReference?: string;
}

export interface PermissionProbeResult {
  name: string;
  allowed: boolean;
  expected: boolean;
  ok: boolean;
}

export interface ConfigureClickatonPartnersResult {
  alreadyConfigured: boolean;
  agreement: EconomicAgreement;
  participants: {
    dani: AgreementParticipant;
    rodri: AgreementParticipant;
    tammy: AgreementParticipant;
  };
  accounts: {
    dani: PaymentAccount;
    rodri: PaymentAccount;
    tammy: PaymentAccount;
  };
  published: DistributionVersion;
  snapshot: OrderDistributionSnapshot;
  amounts: { dani: bigint; rodri: bigint; tammy: bigint; total: bigint };
  permissionProbes: PermissionProbeResult[];
  bridge: {
    recipients: number;
    providerAccounts: number;
    engineEntries: number;
    totalBps: number;
  };
}

function actorFor(
  userId: number,
  grantsByUserId: Map<number, FinanceGrant[]>,
  ownedIdentityIds: string[],
): FinanceActor {
  return {
    userId,
    grants: grantsByUserId.get(userId) ?? [],
    ownedFinancialIdentityIds: ownedIdentityIds,
  };
}

function ensurePartnerIdentityAndAccount(input: {
  store: FinancialDomainStore;
  identities: FinancialIdentityService;
  partner: PartnerUserRef;
  providerUserId: string;
  credentialReference: string;
}): { identityId: string; account: PaymentAccount } {
  const identity = input.identities.getOrCreatePrimaryFinancialIdentityForUser({
    userId: input.partner.userId,
    legalName: input.partner.legalName,
    countryCode: "AR",
  });
  const existing = [...input.store.accounts.values()].find(
    (a) =>
      a.financialIdentityId === identity.id &&
      a.provider === "MERCADOPAGO" &&
      a.environment === "TEST" &&
      a.providerUserId === input.providerUserId &&
      a.status !== "DISABLED" &&
      a.status !== "REVOKED",
  );
  if (existing) {
    return { identityId: identity.id, account: existing };
  }
  const created = input.identities.registerPaymentAccountReference({
    financialIdentityId: identity.id,
    provider: "MERCADOPAGO",
    environment: "TEST",
    providerUserId: input.providerUserId,
    originApp: "clickaton_10d3i_e_fixture",
    isPrimary: true,
    credentialReference: input.credentialReference,
    capabilities: ["COLLECTOR", "SPLIT_RECEIVER"],
  });
  const account = input.store.accounts.get(created.id);
  if (!account) {
    throw new Error("ACCOUNT_REGISTER_MISSING_FROM_STORE");
  }
  return { identityId: identity.id, account };
}

function runPermissionProbes(input: {
  daniActor: FinanceActor;
  rodriActor: FinanceActor;
  tammyActor: FinanceActor;
  adminNoFinance: FinanceActor;
  productKey: string;
  daniIdentityId: string;
  rodriIdentityId: string;
  tammyIdentityId: string;
}): PermissionProbeResult[] {
  const ctx = { productKey: input.productKey };
  const probes: Array<Omit<PermissionProbeResult, "ok">> = [
    {
      name: "dani_create_agreement",
      allowed: canPerformFinanceAction(input.daniActor, "create_agreement", ctx),
      expected: true,
    },
    {
      name: "dani_publish",
      allowed: canPerformFinanceAction(input.daniActor, "publish_distribution", ctx),
      expected: true,
    },
    {
      name: "rodri_assign_own_account",
      allowed: canPerformFinanceAction(input.rodriActor, "assign_own_payment_account", {
        financialIdentityId: input.rodriIdentityId,
      }),
      expected: true,
    },
    {
      name: "tammy_assign_own_account",
      allowed: canPerformFinanceAction(input.tammyActor, "assign_own_payment_account", {
        financialIdentityId: input.tammyIdentityId,
      }),
      expected: true,
    },
    {
      name: "rodri_publish_blocked",
      allowed: canPerformFinanceAction(input.rodriActor, "publish_distribution", ctx),
      expected: false,
    },
    {
      name: "tammy_publish_blocked",
      allowed: canPerformFinanceAction(input.tammyActor, "publish_distribution", ctx),
      expected: false,
    },
    {
      name: "admin_clickaton_no_grant_publish_blocked",
      allowed: canPerformFinanceAction(input.adminNoFinance, "publish_distribution", ctx),
      expected: false,
    },
    {
      name: "rodri_assign_dani_account_blocked",
      allowed: canPerformFinanceAction(input.rodriActor, "assign_own_payment_account", {
        financialIdentityId: input.daniIdentityId,
      }),
      expected: false,
    },
    {
      name: "tammy_assign_rodri_account_blocked",
      allowed: canPerformFinanceAction(input.tammyActor, "assign_own_payment_account", {
        financialIdentityId: input.rodriIdentityId,
      }),
      expected: false,
    },
  ];
  return probes.map((p) => ({ ...p, ok: p.allowed === p.expected }));
}

/**
 * Idempotent configure: identities + TEST accounts + agreement 34/33/33 + snapshot.
 */
export function configureClickatonPartnersAgreement(
  input: ConfigureClickatonPartnersInput,
): ConfigureClickatonPartnersResult {
  const { identities, agreements, partners, grantsByUserId } = input;
  const totalMinor = input.totalMinorForSnapshot ?? 100_000n;
  const externalReference =
    input.externalReference ?? "clickaton-10d3i-e-sim-order-100000";

  const cred = {
    dani: input.credentialRefs?.dani ?? "vault:test:e10-dani",
    rodri: input.credentialRefs?.rodri ?? "vault:test:e10-rodri",
    tammy: input.credentialRefs?.tammy ?? "vault:test:e10-tammy",
  };

  const daniSeed = ensurePartnerIdentityAndAccount({
    store: input.store,
    identities,
    partner: partners.dani,
    providerUserId: CLICKATON_PARTNERS_MP_IDS.dani,
    credentialReference: cred.dani,
  });
  const rodriSeed = ensurePartnerIdentityAndAccount({
    store: input.store,
    identities,
    partner: partners.rodri,
    providerUserId: CLICKATON_PARTNERS_MP_IDS.rodri,
    credentialReference: cred.rodri,
  });
  const tammySeed = ensurePartnerIdentityAndAccount({
    store: input.store,
    identities,
    partner: partners.tammy,
    providerUserId: CLICKATON_PARTNERS_MP_IDS.tammy,
    credentialReference: cred.tammy,
  });

  const daniActor = actorFor(partners.dani.userId, grantsByUserId, [
    daniSeed.identityId,
  ]);
  const rodriActor = actorFor(partners.rodri.userId, grantsByUserId, [
    rodriSeed.identityId,
  ]);
  const tammyActor = actorFor(partners.tammy.userId, grantsByUserId, [
    tammySeed.identityId,
  ]);
  const adminNoFinance = actorFor(
    // synthetic admin probe userId — never used for persistence
    -9200,
    new Map(),
    [],
  );

  const permissionProbes = runPermissionProbes({
    daniActor,
    rodriActor,
    tammyActor,
    adminNoFinance,
    productKey: CLICKATON_PARTNERS_AGREEMENT.productKey,
    daniIdentityId: daniSeed.identityId,
    rodriIdentityId: rodriSeed.identityId,
    tammyIdentityId: tammySeed.identityId,
  });

  const existing = agreements.resolveAgreementForOrder({
    productKey: CLICKATON_PARTNERS_AGREEMENT.productKey,
    scopeType: CLICKATON_PARTNERS_AGREEMENT.scopeType,
    scopeId: CLICKATON_PARTNERS_AGREEMENT.scopeId,
  });

  let agreement: EconomicAgreement;
  let pDani: AgreementParticipant;
  let pRodri: AgreementParticipant;
  let pTammy: AgreementParticipant;
  let published: DistributionVersion;
  let alreadyConfigured = false;

  const publishedExisting =
    existing != null ? agreements.getCurrentPublishedVersion(existing.id) : null;

  if (existing && publishedExisting) {
    alreadyConfigured = true;
    agreement = existing;
    published = publishedExisting;
    const parts = [...input.store.participants.values()].filter(
      (p) => p.agreementId === agreement.id,
    );
    const byIdentity = new Map(parts.map((p) => [p.financialIdentityId, p]));
    const d = byIdentity.get(daniSeed.identityId);
    const r = byIdentity.get(rodriSeed.identityId);
    const t = byIdentity.get(tammySeed.identityId);
    if (!d || !r || !t) {
      throw new Error("EXISTING_AGREEMENT_MISSING_PARTICIPANTS");
    }
    pDani = d;
    pRodri = r;
    pTammy = t;
  } else {
    agreement =
      existing ??
      agreements.createEconomicAgreement(daniActor, {
        ...CLICKATON_PARTNERS_AGREEMENT,
      });

    const partsExisting = [...input.store.participants.values()].filter(
      (p) => p.agreementId === agreement.id,
    );
    const byIdentity = new Map(
      partsExisting.map((p) => [p.financialIdentityId, p]),
    );

    pDani =
      byIdentity.get(daniSeed.identityId) ??
      agreements.inviteAgreementParticipant(daniActor, {
        agreementId: agreement.id,
        financialIdentityId: daniSeed.identityId,
        roleLabel: "PARTNER",
      });
    pRodri =
      byIdentity.get(rodriSeed.identityId) ??
      agreements.inviteAgreementParticipant(daniActor, {
        agreementId: agreement.id,
        financialIdentityId: rodriSeed.identityId,
        roleLabel: "PARTNER",
      });
    pTammy =
      byIdentity.get(tammySeed.identityId) ??
      agreements.inviteAgreementParticipant(daniActor, {
        agreementId: agreement.id,
        financialIdentityId: tammySeed.identityId,
        roleLabel: "PARTNER",
      });

    for (const [actor, participant] of [
      [daniActor, pDani],
      [rodriActor, pRodri],
      [tammyActor, pTammy],
    ] as const) {
      if (participant.status === "INVITED") {
        agreements.acceptAgreementParticipation(actor, participant.id);
      }
    }

    // Refresh after accept
    pDani = input.store.participants.get(pDani.id)!;
    pRodri = input.store.participants.get(pRodri.id)!;
    pTammy = input.store.participants.get(pTammy.id)!;

    if (!pDani.paymentAccountId) {
      agreements.assignParticipantPaymentAccount(daniActor, {
        participantId: pDani.id,
        paymentAccountId: daniSeed.account.id,
      });
    }
    if (!pRodri.paymentAccountId) {
      agreements.assignParticipantPaymentAccount(rodriActor, {
        participantId: pRodri.id,
        paymentAccountId: rodriSeed.account.id,
      });
    }
    if (!pTammy.paymentAccountId) {
      agreements.assignParticipantPaymentAccount(tammyActor, {
        participantId: pTammy.id,
        paymentAccountId: tammySeed.account.id,
      });
    }
    pDani = input.store.participants.get(pDani.id)!;
    pRodri = input.store.participants.get(pRodri.id)!;
    pTammy = input.store.participants.get(pTammy.id)!;

    const draft = agreements.createDistributionDraft(daniActor, agreement.id);
    agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pDani.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.dani,
      priority: 1,
    });
    agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pRodri.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.rodri,
      priority: 2,
    });
    agreements.addOrUpdateDraftRule({
      distributionVersionId: draft.id,
      agreementParticipantId: pTammy.id,
      kind: "PERCENTAGE",
      value: CLICKATON_PARTNERS_BPS.tammy,
      priority: 3,
    });

    published = agreements.publishDistributionVersion(daniActor, draft.id);
  }

  // Snapshot: append-only. For alreadyConfigured, create a fresh sim snapshot if none for this ext ref.
  const existingSnap = [...input.store.snapshots.values()].find(
    (s) =>
      s.agreementId === agreement.id && s.externalReference === externalReference,
  );
  const { snapshot } =
    existingSnap != null
      ? { snapshot: existingSnap }
      : agreements.buildAndPersistOrderSnapshot({
          agreementId: agreement.id,
          totalMinor,
          externalReference,
        });

  const byParticipant = new Map(
    snapshot.payload.participants.map((p) => [p.agreementParticipantId, p]),
  );
  const amounts = {
    dani: BigInt(byParticipant.get(pDani.id)?.amountMinor ?? "0"),
    rodri: BigInt(byParticipant.get(pRodri.id)?.amountMinor ?? "0"),
    tammy: BigInt(byParticipant.get(pTammy.id)?.amountMinor ?? "0"),
    total: totalMinor,
  };

  const rules = [...input.store.rules.values()].filter(
    (r) => r.distributionVersionId === published.id,
  );
  const participants = [pDani, pRodri, pTammy];
  const engineRules = distributionRulesToEngineInput(
    rules,
    participants,
    "ARS",
  );
  const calculated = calculateDistribution({
    total: money("ARS", totalMinor),
    rules: engineRules,
    rounding: published.roundingPolicy,
    eligibleRecipientIds: participants.map((p) => p.id),
  });
  const totalBps = rules.reduce((acc, r) => acc + Number(r.value), 0);

  const bridge = {
    recipients: participants.map((p) => {
      const identity = input.store.identities.get(p.financialIdentityId)!;
      return financialIdentityToRecipientDraft(identity);
    }).length,
    providerAccounts: [daniSeed.account, rodriSeed.account, tammySeed.account]
      .map(paymentAccountToProviderAccountDraft).length,
    engineEntries: calculated.entries.length,
    totalBps,
  };

  if (bridge.totalBps !== 10_000) {
    throw new Error(`INVALID_BPS_TOTAL:${bridge.totalBps}`);
  }
  if (amounts.dani + amounts.rodri + amounts.tammy !== totalMinor) {
    throw new Error("SNAPSHOT_AMOUNTS_MISMATCH");
  }
  if (permissionProbes.some((p) => !p.ok)) {
    throw new Error(
      `PERMISSION_PROBES_FAILED:${permissionProbes
        .filter((p) => !p.ok)
        .map((p) => p.name)
        .join(",")}`,
    );
  }

  return {
    alreadyConfigured,
    agreement: input.store.agreements.get(agreement.id)!,
    participants: { dani: pDani, rodri: pRodri, tammy: pTammy },
    accounts: {
      dani: daniSeed.account,
      rodri: rodriSeed.account,
      tammy: tammySeed.account,
    },
    published,
    snapshot,
    amounts,
    permissionProbes,
    bridge,
  };
}
