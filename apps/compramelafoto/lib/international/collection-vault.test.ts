import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CredentialVaultError,
  UNIT_TEST_MASTER_KEY_BASE64,
  createMemoryCredentialStore,
} from "@repo/payments/credential-vault";
import {
  decryptCollectionSecret,
  encryptCollectionSecret,
  isCollectionVaultConfigured,
} from "./collection-vault";
import type { IntlCollectionSecret } from "./collection-secret";

const env = { DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST: UNIT_TEST_MASTER_KEY_BASE64 };
const paypal: IntlCollectionSecret = {
  provider: "PAYPAL_OWN",
  clientId: "AaBbCcDdEeFfGgHhIiJjKkLl",
  clientSecret: "EXAMPLE-SECRET-VALUE-1234567890",
};
const mp: IntlCollectionSecret = { provider: "MERCADOPAGO_OWN", accessToken: "TEST-1234567890-abcdef" };

describe("collection-vault", () => {
  it("cifra y descifra un secreto de PayPal", async () => {
    const store = createMemoryCredentialStore();
    const { credentialId } = await encryptCollectionSecret(paypal, "TEST", { store, env });
    assert.match(credentialId, /^dnxcred_[0-9a-f]{20}$/);
    assert.deepEqual(await decryptCollectionSecret(credentialId, { store, env }), paypal);
  });

  it("no guarda el secreto en texto y registra provider y purpose", async () => {
    const store = createMemoryCredentialStore();
    const a = await encryptCollectionSecret(paypal, "TEST", { store, env });
    const b = await encryptCollectionSecret(mp, "TEST", { store, env });
    const recA = store.records.get(a.credentialId)!;
    const recB = store.records.get(b.credentialId)!;
    assert.ok(!recA.ciphertext.includes(paypal.clientSecret));
    assert.ok(!recB.ciphertext.includes(mp.accessToken));
    assert.equal(recA.provider, "PAYPAL");
    assert.equal(recB.provider, "MERCADOPAGO");
    assert.equal(recA.purpose, "clf_intl_collection");
  });

  it("sin clave rechaza y no guarda nada", async () => {
    const store = createMemoryCredentialStore();
    await assert.rejects(
      encryptCollectionSecret(paypal, "PROD", { store, env: {} }),
      (e) => e instanceof CredentialVaultError && e.code === "MASTER_KEY_MISSING",
    );
    assert.equal(store.records.size, 0);
  });

  it("isCollectionVaultConfigured", () => {
    assert.equal(isCollectionVaultConfigured("PROD", {}), false);
    assert.equal(isCollectionVaultConfigured("TEST", env), true);
    assert.equal(isCollectionVaultConfigured("TEST", { DNX_FINANCIAL_CREDENTIAL_MASTER_KEY_TEST: "abc" }), false);
  });

  it("descifrar un id revocado rechaza", async () => {
    const store = createMemoryCredentialStore();
    const { credentialId } = await encryptCollectionSecret(mp, "TEST", { store, env });
    await store.markRevoked(credentialId);
    await assert.rejects(
      decryptCollectionSecret(credentialId, { store, env }),
      (e) => e instanceof CredentialVaultError && e.code === "CREDENTIAL_REVOKED",
    );
  });
});
