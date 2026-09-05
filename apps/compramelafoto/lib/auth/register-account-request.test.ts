import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCOUNT_TYPE_OPTIONS,
  buildRegisterAccountRequest,
  googleRoleForAccountType,
  parseAccountType,
} from "./register-account-request";

describe("parseAccountType", () => {
  it("por defecto asume fotógrafo (es el público principal de CLF)", () => {
    assert.equal(parseAccountType(null), "PHOTOGRAPHER");
    assert.equal(parseAccountType("cualquier-cosa"), "PHOTOGRAPHER");
  });

  it("reconoce cliente", () => {
    assert.equal(parseAccountType("CUSTOMER"), "CUSTOMER");
  });

  it("ofrece las dos opciones al usuario", () => {
    assert.deepEqual(
      ACCOUNT_TYPE_OPTIONS.map((o) => o.value),
      ["PHOTOGRAPHER", "CUSTOMER"]
    );
  });
});

describe("buildRegisterAccountRequest", () => {
  const base = { name: "Ana Gómez", email: "ana@test.com", password: "Secreta123" };

  it("el fotógrafo va al endpoint de fotógrafo y lleva el ref", () => {
    const req = buildRegisterAccountRequest({
      ...base,
      accountType: "PHOTOGRAPHER",
      refCode: "SQZW2CCT",
      trainingMeta: null,
    });
    assert.equal(req.endpoint, "/api/auth/register-photographer");
    assert.equal(req.body.ref, "SQZW2CCT");
    assert.equal(req.body.marketingOptIn, true);
  });

  it("el cliente va al registro genérico", () => {
    const req = buildRegisterAccountRequest({
      ...base,
      accountType: "CUSTOMER",
      refCode: "SQZW2CCT",
      trainingMeta: null,
    });
    assert.equal(req.endpoint, "/api/auth/register");
    assert.equal(req.body.ref, undefined);
  });

  it("no manda ref si no hay", () => {
    const req = buildRegisterAccountRequest({
      ...base,
      accountType: "PHOTOGRAPHER",
      refCode: null,
      trainingMeta: null,
    });
    assert.equal(req.body.ref, undefined);
  });

  it("propaga el origen de capacitación", () => {
    const req = buildRegisterAccountRequest({
      ...base,
      accountType: "PHOTOGRAPHER",
      refCode: "SQZW2CCT",
      trainingMeta: { sourceType: "TRAINING", sourceEntityId: 4 },
    });
    assert.equal(req.body.sourceType, "TRAINING");
    assert.equal(req.body.sourceEntityId, 4);
  });
});

describe("googleRoleForAccountType", () => {
  it("nunca usa AUTO, que impide crear la cuenta", () => {
    assert.equal(googleRoleForAccountType("PHOTOGRAPHER"), "PHOTOGRAPHER");
    assert.equal(googleRoleForAccountType("CUSTOMER"), "CUSTOMER");
  });
});
