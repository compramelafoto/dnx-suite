import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actor,
  createTestFinancialServices,
  FIXTURE_MP_IDS,
  FIXTURE_USERS,
  grant,
} from "../testing/financial-fixtures.js";
import { FinancialIdentityError } from "./errors.js";

describe("FinancialIdentity", () => {
  it("creates primary identity for user (idempotent)", () => {
    const { identities } = createTestFinancialServices();
    const a = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
      legalName: "Dani Test",
    });
    const b = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    assert.equal(a.id, b.id);
    assert.equal(a.isPrimary, true);
    assert.equal(a.subjectType, "PERSON");
  });

  it("supports organization identities distinct from person primary", () => {
    const { identities } = createTestFinancialServices();
    const person = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    const org = identities.createOrganizationIdentity({
      countryCode: "AR",
      legalName: "Empresa Test SA",
      taxId: "30-00000000-0",
      ownerUserId: FIXTURE_USERS.dani.userId,
    });
    assert.notEqual(person.id, org.id);
    assert.equal(org.subjectType, "ORGANIZATION");
    assert.equal(org.isPrimary, false);
  });

  it("allows multiple PaymentAccounts on one identity", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: FIXTURE_MP_IDS.dani,
      isPrimary: true,
    });
    identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: "TEST_DANI_ALT",
    });
    assert.equal(identities.listPaymentAccounts(dani.id).length, 2);
  });

  it("rejects duplicate live providerUserId across identities", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    const rodri = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.rodri.userId,
    });
    identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: FIXTURE_MP_IDS.dani,
    });
    assert.throws(
      () =>
        identities.registerPaymentAccountReference({
          financialIdentityId: rodri.id,
          provider: "MERCADOPAGO",
          environment: "TEST",
          providerUserId: FIXTURE_MP_IDS.dani,
        }),
      (err: unknown) =>
        err instanceof FinancialIdentityError &&
        err.code === "PROVIDER_ACCOUNT_CONFLICT",
    );
  });

  it("keeps TEST and PROD accounts separate", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: FIXTURE_MP_IDS.dani,
    });
    const prod = identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "PROD",
      providerUserId: FIXTURE_MP_IDS.dani,
    });
    assert.equal(prod.environment, "PROD");
    assert.equal(identities.listPaymentAccounts(dani.id).length, 2);
  });

  it("suspended account is not eligible; primary resolves when valid", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    const primary = identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: FIXTURE_MP_IDS.dani,
      isPrimary: true,
    });
    const secondary = identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: "TEST_DANI_2",
    });
    identities.suspendPaymentAccount(primary.id);
    assert.equal(
      identities.resolveEligiblePaymentAccount({
        financialIdentityId: dani.id,
        environment: "TEST",
      })?.id,
      secondary.id,
    );

    identities.setPrimaryPaymentAccount(secondary.id);
    assert.equal(
      identities.resolveEligiblePaymentAccount({
        financialIdentityId: dani.id,
        environment: "TEST",
      })?.id,
      secondary.id,
    );
  });

  it("rejects raw token-looking credentialReference", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    assert.throws(
      () =>
        identities.registerPaymentAccountReference({
          financialIdentityId: dani.id,
          provider: "MERCADOPAGO",
          environment: "TEST",
          providerUserId: FIXTURE_MP_IDS.dani,
          credentialReference: "TEST-abc123",
        }),
      (err: unknown) =>
        err instanceof FinancialIdentityError && err.code === "RAW_TOKEN_FORBIDDEN",
    );
  });

  it("public account view never exposes credentialReference", () => {
    const { identities } = createTestFinancialServices();
    const dani = identities.getOrCreatePrimaryFinancialIdentityForUser({
      userId: FIXTURE_USERS.dani.userId,
    });
    const account = identities.registerPaymentAccountReference({
      financialIdentityId: dani.id,
      provider: "MERCADOPAGO",
      environment: "TEST",
      providerUserId: FIXTURE_MP_IDS.dani,
      credentialReference: "vault:test:dani",
    });
    assert.equal("credentialReference" in account, false);
    assert.equal(account.hasCredentialReference, true);
    const json = JSON.stringify(account);
    assert.equal(json.includes("vault:"), false);
    assert.equal(json.includes("credentialReference"), false);
  });

  it("documents that finance grants must be explicit (not email)", () => {
    const clickatonAdmin = actor(FIXTURE_USERS.clickatonAdminNoFinance.userId, []);
    const owner = actor(FIXTURE_USERS.financeOwner.userId, [
      grant(FIXTURE_USERS.financeOwner.userId, "DNX_FINANCE_OWNER"),
    ]);
    assert.equal(clickatonAdmin.grants.length, 0);
    assert.equal(owner.grants[0]?.capability, "DNX_FINANCE_OWNER");
  });
});
