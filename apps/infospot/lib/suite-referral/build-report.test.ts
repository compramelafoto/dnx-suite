/**
 * Tests del armado del aviso de referido (sin red / sin cookies).
 * Ejecutar: pnpm --filter infospot test:suite-referral
 */

import assert from "node:assert/strict";
import { buildInfoSpotReferralReport } from "./build-report";

// 1. Sin cookie o con basura: no se avisa.
{
  const user = { id: 7, email: "a@b.com", name: "Ana" };
  assert.equal(buildInfoSpotReferralReport(undefined, user), null);
  assert.equal(buildInfoSpotReferralReport(null, user), null);
  assert.equal(buildInfoSpotReferralReport("", user), null);
  assert.equal(buildInfoSpotReferralReport("no válido!", user), null);
}

// 2. Código válido: se normaliza y se arma el aviso con plataforma infospot.
{
  const report = buildInfoSpotReferralReport(" abc123 ", { id: 7, email: "a@b.com", name: "Ana" });
  assert.deepEqual(report, {
    platform: "infospot",
    code: "ABC123",
    externalUserId: 7,
    email: "a@b.com",
    name: "Ana",
  });
}

// 3. Sin nombre: name queda null. Sin email: no se avisa.
{
  const report = buildInfoSpotReferralReport("ABC123", { id: "x1", email: "a@b.com" });
  assert.equal(report?.name, null);
  assert.equal(report?.externalUserId, "x1");
  assert.equal(buildInfoSpotReferralReport("ABC123", { id: 1, email: "  " }), null);
}

console.log("suite-referral build-report: OK");
