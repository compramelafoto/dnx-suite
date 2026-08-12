import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  WELCOME_CONTEXT_FOTORANK_ENV,
  WELCOME_CONTEXT_CLF_ENV,
  getWelcomeClfConnectionInfo,
  getWelcomeFotorankConnectionInfo,
  getWelcomeFotorankClient,
  getWelcomeClfClient,
} from "./partners-welcome-context-clients";

describe("welcome context clients fail-closed", () => {
  const prevFr = process.env[WELCOME_CONTEXT_FOTORANK_ENV];
  const prevClf = process.env[WELCOME_CONTEXT_CLF_ENV];

  before(() => {
    delete process.env[WELCOME_CONTEXT_FOTORANK_ENV];
    delete process.env[WELCOME_CONTEXT_CLF_ENV];
  });

  after(() => {
    if (prevFr === undefined) delete process.env[WELCOME_CONTEXT_FOTORANK_ENV];
    else process.env[WELCOME_CONTEXT_FOTORANK_ENV] = prevFr;
    if (prevClf === undefined) delete process.env[WELCOME_CONTEXT_CLF_ENV];
    else process.env[WELCOME_CONTEXT_CLF_ENV] = prevClf;
  });

  it("FotoRank ausente: configured=false y client lanza", () => {
    const info = getWelcomeFotorankConnectionInfo();
    assert.equal(info.configured, false);
    assert.match(info.reason ?? "", /DNX_PARTNERS_FOTORANK_DATABASE_URL/);
    assert.throws(() => getWelcomeFotorankClient(), /DNX_PARTNERS_FOTORANK/);
  });

  it("CLF ausente: configured=false y client lanza (sin fallback Clickatón)", () => {
    const info = getWelcomeClfConnectionInfo();
    assert.equal(info.configured, false);
    assert.match(info.reason ?? "", /DNX_PARTNERS_CLF_DATABASE_URL/);
    assert.throws(() => getWelcomeClfClient(), /DNX_PARTNERS_CLF|no configurada/i);
  });

  it("FotoRank configurada reporta fingerprint sin secretos", () => {
    process.env[WELCOME_CONTEXT_FOTORANK_ENV] =
      "postgresql://u:p@ep-example-pooler.us-east-1.aws.neon.tech/neondb";
    const info = getWelcomeFotorankConnectionInfo();
    assert.equal(info.configured, true);
    assert.ok(info.hostMasked);
    assert.ok(info.fingerprint);
    assert.ok(!JSON.stringify(info).includes("postgresql://u:p"));
    delete process.env[WELCOME_CONTEXT_FOTORANK_ENV];
  });
});
