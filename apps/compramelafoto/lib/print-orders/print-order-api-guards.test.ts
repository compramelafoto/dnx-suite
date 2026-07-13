/**
 * Tests: reglas de estado y uploads de print-orders (Etapa 11).
 * Ejecutar: pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/lib/print-orders/print-order-api-guards.test.ts
 */

import assert from "node:assert/strict";
import {
  BULK_STATUS_MAX_IDS,
  canTransitionPrintOrderStatus,
  isAllowedPrintOrderStatus,
} from "./print-order-status";
import {
  contentTypeFromFilename,
  isAllowedPrintUpload,
  sanitizeUploadBasename,
} from "./upload-guards";

{
  assert.equal(isAllowedPrintOrderStatus("CREATED"), true);
  assert.equal(isAllowedPrintOrderStatus("PAID"), false);
  assert.equal(BULK_STATUS_MAX_IDS, 100);
}

{
  assert.equal(canTransitionPrintOrderStatus("CREATED", "CREATED").ok, true);
  assert.equal(canTransitionPrintOrderStatus("CREATED", "IN_PRODUCTION").ok, true);
  assert.equal(canTransitionPrintOrderStatus("CREATED", "READY").ok, true);
  assert.equal(canTransitionPrintOrderStatus("DELIVERED", "IN_PRODUCTION").ok, false);
  assert.equal(canTransitionPrintOrderStatus("CANCELED", "READY").ok, false);
  assert.equal(canTransitionPrintOrderStatus("IN_PRODUCTION", "BOGUS").ok, false);
}

{
  const ok = isAllowedPrintUpload("foto.jpg", "image/jpeg");
  assert.equal(ok.ok, true);
  assert.equal(ok.contentType, "image/jpeg");

  const bad = isAllowedPrintUpload("malware.exe");
  assert.equal(bad.ok, false);

  const svg = isAllowedPrintUpload("x.svg");
  assert.equal(svg.ok, false);

  assert.equal(contentTypeFromFilename("a.PNG"), "image/png");
  assert.equal(sanitizeUploadBasename("../../etc/passwd.jpg"), "passwd.jpg");
}

console.log("print-order-api-guards.test.ts: ok");
