import { EconomicAgreementService } from "../economic-agreement/service.js";
import type { FinanceActor, FinanceGrant } from "../finance-permissions/types.js";
import {
  createFinancialDomainStore,
  FinancialIdentityService,
  type FinancialDomainStore,
} from "../financial-identity/index.js";

/** Fictitious fixtures — no real emails, no real MP tokens. */
export const FIXTURE_USERS = {
  dani: { userId: 9001, name: "Dani Test" },
  rodri: { userId: 9002, name: "Rodri Test" },
  tammy: { userId: 9003, name: "Tammy Test" },
  financeOwner: { userId: 9100, name: "Finance Owner Test" },
  clickatonAdminNoFinance: { userId: 9200, name: "Clickaton Admin No Finance" },
} as const;

export const FIXTURE_MP_IDS = {
  dani: "TEST_DANI",
  rodri: "TEST_RODRI",
  tammy: "TEST_TAMMY",
} as const;

export function grant(
  userId: number,
  capability: FinanceGrant["capability"],
  productKey: string | null = null,
): FinanceGrant {
  const now = new Date();
  return {
    id: `grant_${userId}_${capability}`,
    userId,
    capability,
    productKey,
    scopeType: null,
    scopeId: null,
    status: "ACTIVE",
    grantedByUserId: FIXTURE_USERS.financeOwner.userId,
    createdAt: now,
    updatedAt: now,
  };
}

export function actor(
  userId: number,
  grants: FinanceGrant[],
  ownedFinancialIdentityIds: string[] = [],
): FinanceActor {
  return { userId, grants, ownedFinancialIdentityIds };
}

export function createTestFinancialServices(store?: FinancialDomainStore): {
  store: FinancialDomainStore;
  identities: FinancialIdentityService;
  agreements: EconomicAgreementService;
} {
  const s = store ?? createFinancialDomainStore();
  return {
    store: s,
    identities: new FinancialIdentityService(s),
    agreements: new EconomicAgreementService(s),
  };
}

/** Seeds Dani/Rodri/Tammy identities + TEST MP account refs (no tokens). */
export function seedClickatonPartnersFixture(services: {
  store: FinancialDomainStore;
  identities: FinancialIdentityService;
  agreements: EconomicAgreementService;
}) {
  const { identities } = services;
  const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
    userId: FIXTURE_USERS.dani.userId,
    legalName: FIXTURE_USERS.dani.name,
    countryCode: "AR",
  });
  const rodri = identities.getOrCreatePrimaryFinancialIdentityForUser({
    userId: FIXTURE_USERS.rodri.userId,
    legalName: FIXTURE_USERS.rodri.name,
    countryCode: "AR",
  });
  const tammy = identities.getOrCreatePrimaryFinancialIdentityForUser({
    userId: FIXTURE_USERS.tammy.userId,
    legalName: FIXTURE_USERS.tammy.name,
    countryCode: "AR",
  });

  const daniAccount = identities.registerPaymentAccountReference({
    financialIdentityId: dani.id,
    provider: "MERCADOPAGO",
    environment: "TEST",
    providerUserId: FIXTURE_MP_IDS.dani,
    originApp: "test_fixture",
    isPrimary: true,
    credentialReference: "vault:test:dani",
  });
  const rodriAccount = identities.registerPaymentAccountReference({
    financialIdentityId: rodri.id,
    provider: "MERCADOPAGO",
    environment: "TEST",
    providerUserId: FIXTURE_MP_IDS.rodri,
    originApp: "test_fixture",
    isPrimary: true,
    credentialReference: "vault:test:rodri",
  });
  const tammyAccount = identities.registerPaymentAccountReference({
    financialIdentityId: tammy.id,
    provider: "MERCADOPAGO",
    environment: "TEST",
    providerUserId: FIXTURE_MP_IDS.tammy,
    originApp: "test_fixture",
    isPrimary: true,
    credentialReference: "vault:test:tammy",
  });

  return {
    dani,
    rodri,
    tammy,
    daniAccount,
    rodriAccount,
    tammyAccount,
  };
}
