/**
 * Selfcheck unitario del contrato de identidad DNX (sin DB).
 * pnpm --filter @repo/auth identity:selfcheck
 */

import assert from "node:assert/strict";
import { hashSync } from "bcryptjs";
import {
  detectPasswordHashFormat,
  isCanonicalPasswordHash,
  isLegacyPasswordHash,
  normalizeIdentityEmail,
  requireNormalizedIdentityEmail,
  DNX_APPLICATIONS,
} from "./identity";
import { hashPassword, verifyPassword } from "./password";
import {
  validatePasswordPolicy,
  DNX_PASSWORD_MIN_LENGTH,
} from "./password-policy";
import { sanitizeReturnTo, isSafeReturnTo } from "./return-to";
import { DNX_AUTH_MESSAGES } from "./messages";

function section(name: string) {
  console.log(`\n— ${name}`);
}

function main() {
  section("1. normalizeIdentityEmail");
  assert.deepEqual(normalizeIdentityEmail("  Foo@Bar.COM "), {
    ok: true,
    email: "foo@bar.com",
  });
  assert.equal(normalizeIdentityEmail("").ok, false);
  assert.equal(normalizeIdentityEmail("not-an-email").ok, false);
  assert.equal(requireNormalizedIdentityEmail("A@B.co"), "a@b.co");
  try {
    requireNormalizedIdentityEmail("bad");
    assert.fail("expected throw");
  } catch {
    /* ok */
  }

  section("2. password canonical scrypt");
  {
    const hashed = hashPassword("TestPass-123!");
    assert.equal(detectPasswordHashFormat(hashed), "scrypt_v1");
    assert.equal(isCanonicalPasswordHash(hashed), true);
    assert.equal(verifyPassword("TestPass-123!", hashed), true);
    assert.equal(verifyPassword("wrong", hashed), false);
  }

  section("3. bcrypt legacy detect + verify");
  {
    const bcryptHash = hashSync("legacy-pass", 4);
    assert.equal(detectPasswordHashFormat(bcryptHash), "bcrypt_legacy");
    assert.equal(isLegacyPasswordHash(bcryptHash), true);
    assert.equal(verifyPassword("legacy-pass", bcryptHash), true);
    assert.equal(verifyPassword("nope", bcryptHash), false);
    assert.equal(isCanonicalPasswordHash(bcryptHash), false);
  }

  section("4. unknown format");
  assert.equal(detectPasswordHashFormat("plain-text"), "unknown");
  assert.equal(detectPasswordHashFormat(""), "unknown");

  section("5. DNX_APPLICATIONS contract export");
  assert.ok(DNX_APPLICATIONS.includes("compramelafoto"));
  assert.ok(DNX_APPLICATIONS.includes("clickaton"));
  assert.ok(DNX_APPLICATIONS.includes("fotorank"));
  assert.ok(DNX_APPLICATIONS.includes("infospot"));
  assert.ok(DNX_APPLICATIONS.includes("fotoffice"));

  section("6. password policy");
  assert.equal(validatePasswordPolicy("short").ok, false);
  assert.equal(validatePasswordPolicy("a".repeat(DNX_PASSWORD_MIN_LENGTH)).ok, true);
  assert.equal(
    validatePasswordPolicy("password123", { confirm: "other" }).ok,
    false,
  );

  section("7. returnTo anti open-redirect");
  assert.equal(sanitizeReturnTo("https://evil.com"), "/");
  assert.equal(sanitizeReturnTo("//evil.com"), "/");
  assert.equal(sanitizeReturnTo("/mi-cuenta"), "/mi-cuenta");
  assert.equal(isSafeReturnTo("/ok"), true);
  assert.equal(isSafeReturnTo("https://x"), false);

  section("8. safe messages");
  assert.ok(DNX_AUTH_MESSAGES.resetNeutral.includes("Si existe"));
  assert.ok(DNX_AUTH_MESSAGES.loginInvalid.includes("incorrectos"));

  console.log("\nOK identity.selfcheck");
}

main();
