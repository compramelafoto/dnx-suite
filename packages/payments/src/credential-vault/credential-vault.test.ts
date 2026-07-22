import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptUtf8, decodeMasterKey, encryptUtf8 } from "./aes-gcm.js";
import { UNIT_TEST_MASTER_KEY_BASE64 } from "./keys.js";
import {
  CredentialVault,
  createMemoryCredentialStore,
  fingerprintAccessToken,
  sanitizeCredentialAuditMeta,
} from "./vault.js";
import { CredentialVaultError } from "./types.js";

describe("Credential vault AES-256-GCM", () => {
  it("encrypt/decrypt roundtrip; nonce makes ciphertext unique", () => {
    const key = decodeMasterKey(UNIT_TEST_MASTER_KEY_BASE64);
    const a = encryptUtf8("hello-secret", key);
    const b = encryptUtf8("hello-secret", key);
    assert.notEqual(a.ciphertext, b.ciphertext);
    assert.notEqual(a.nonce, b.nonce);
    assert.equal(decryptUtf8(a, key), "hello-secret");
  });

  it("invalid auth tag fails closed", () => {
    const key = decodeMasterKey(UNIT_TEST_MASTER_KEY_BASE64);
    const parts = encryptUtf8("payload", key);
    parts.authTag = Buffer.alloc(16, 7).toString("base64");
    assert.throws(
      () => decryptUtf8(parts, key),
      (err: unknown) =>
        err instanceof CredentialVaultError && err.code === "DECRYPT_FAILED",
    );
  });

  it("wrong key fails closed", () => {
    const key = decodeMasterKey(UNIT_TEST_MASTER_KEY_BASE64);
    const other = Buffer.alloc(32, 9);
    const parts = encryptUtf8("payload", key);
    assert.throws(() => decryptUtf8(parts, other));
  });

  it("missing master key fails closed", () => {
    const store = createMemoryCredentialStore();
    const vault = new CredentialVault(store, () => {
      throw new CredentialVaultError("MASTER_KEY_MISSING", "missing");
    });
    assert.rejects(
      () =>
        vault.encryptMercadoPagoCredential({
          environment: "TEST",
          payload: {
            accessToken: "TEST-token-fixture",
            refreshToken: null,
            providerUserId: "TEST_X",
            connectedAt: null,
            origin: "compramelafoto_legacy_user",
          },
        }),
      (err: unknown) =>
        err instanceof CredentialVaultError && err.code === "MASTER_KEY_MISSING",
    );
  });

  it("vault encrypt/decrypt and sanitizes audit meta", async () => {
    const store = createMemoryCredentialStore();
    const vault = new CredentialVault(store, () => ({
      masterKeyBase64: UNIT_TEST_MASTER_KEY_BASE64,
      keyVersion: "v1",
      environment: "TEST",
    }));
    const record = await vault.encryptMercadoPagoCredential({
      environment: "TEST",
      payload: {
        accessToken: "TEST-token-fixture-aaaa",
        refreshToken: "TEST-refresh",
        providerUserId: "TEST_DANI",
        connectedAt: null,
        origin: "compramelafoto_legacy_user",
      },
    });
    assert.ok(record.ciphertext);
    assert.equal(JSON.stringify(record).includes("TEST-token-fixture"), false);
    const payload = await vault.decryptMercadoPagoCredential(record.id);
    assert.equal(payload.accessToken, "TEST-token-fixture-aaaa");

    const sanitized = sanitizeCredentialAuditMeta({
      accessToken: "TEST-secret",
      ciphertext: "x",
      userId: 1,
    });
    assert.equal("accessToken" in sanitized, false);
    assert.equal("ciphertext" in sanitized, false);
    assert.equal(sanitized.userId, 1);
    assert.equal(fingerprintAccessToken("a").length, 64);
  });
});
