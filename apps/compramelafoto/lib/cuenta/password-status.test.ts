/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/cuenta/password-status.test.ts
 */

import assert from "node:assert/strict";
import {
  PASSWORD_STATUS_FORBIDDEN_KEYS,
  PASSWORD_STATUS_PUBLIC_KEYS,
  buildPasswordStatus,
} from "./password-status";

{
  const local = buildPasswordStatus({
    password: "hashed-not-exposed",
    googleId: null,
  });
  assert.equal(local.hasLocalPassword, true);
  assert.equal(local.linkedWithGoogle, false);
  assert.equal(local.canChangeLocalPassword, true);
  assert.equal(local.googleOnlyAccount, false);
}

{
  const oauth = buildPasswordStatus({
    password: null,
    googleId: "google-sub-123",
  });
  assert.equal(oauth.hasLocalPassword, false);
  assert.equal(oauth.linkedWithGoogle, true);
  assert.equal(oauth.canChangeLocalPassword, false);
  assert.equal(oauth.googleOnlyAccount, true);
}

{
  const both = buildPasswordStatus({
    password: "x",
    googleId: "g",
  });
  assert.equal(both.hasLocalPassword, true);
  assert.equal(both.linkedWithGoogle, true);
  assert.equal(both.googleOnlyAccount, false);
}

{
  const sample = buildPasswordStatus({ password: "secret", googleId: "gid" });
  for (const key of PASSWORD_STATUS_PUBLIC_KEYS) {
    assert.ok(key in sample);
  }
  for (const key of PASSWORD_STATUS_FORBIDDEN_KEYS) {
    assert.ok(!(key in sample));
  }
  assert.ok(!JSON.stringify(sample).includes("secret"));
  assert.ok(!JSON.stringify(sample).includes("gid"));
}

console.log("password-status.test.ts OK");
