/**
 * pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/public/removal-request.test.ts
 */

import assert from "node:assert/strict";
import { sanitizeRemovalRequestBody } from "./removal-request";

const valid = {
  albumId: 10,
  photoId: 20,
  requesterName: "Ana Pérez",
  requesterEmail: "ana@example.com",
  requesterPhone: "3415551234",
  reason: "Soy la persona de la foto y solicito remoción",
  declarationOk: true,
};

{
  const r = sanitizeRemovalRequestBody(valid);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.requesterEmail, "ana@example.com");
    assert.equal(r.data.declarationOk, true);
  }
}

{
  assert.equal(sanitizeRemovalRequestBody({ ...valid, albumId: 0 }).ok, false);
  assert.equal(sanitizeRemovalRequestBody({ ...valid, photoId: "x" }).ok, false);
  assert.equal(
    sanitizeRemovalRequestBody({ ...valid, requesterEmail: "bad" }).ok,
    false
  );
  assert.equal(
    sanitizeRemovalRequestBody({ ...valid, reason: "corto" }).ok,
    false
  );
  assert.equal(
    sanitizeRemovalRequestBody({ ...valid, declarationOk: false }).ok,
    false
  );
  assert.equal(
    sanitizeRemovalRequestBody({ ...valid, declarationOk: "yes" }).ok,
    false
  );
}

console.log("removal-request.test.ts OK");
