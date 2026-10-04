import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildEligibilityWhere } from "./eligibility-where";

const regla = {
  kind: "PARTICIPATED_IN_EDITION" as const,
  editionIds: ["ed0"],
  requireCheckIn: false,
};

describe("buildEligibilityWhere", () => {
  it("sin email ni cuenta no hay forma de identificar a la persona", () => {
    assert.equal(buildEligibilityWhere(regla, { email: null, userId: null }), null);
  });

  it("busca sólo inscripciones confirmadas y no de prueba", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: null });
    assert.deepEqual(where?.editionId, { in: ["ed0"] });
    assert.equal(where?.status, "CONFIRMED");
    assert.equal(where?.isOpsTest, false);
  });

  it("normaliza el email a minúsculas y sin espacios", () => {
    const where = buildEligibilityWhere(regla, { email: "  Ana@Correo.COM ", userId: null });
    assert.deepEqual(where?.OR, [{ email: "ana@correo.com" }]);
  });

  it("acepta email o cuenta indistintamente", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: 7 });
    assert.deepEqual(where?.OR, [{ email: "a@b.com" }, { userId: 7 }]);
  });

  it("no exige acreditación por defecto", () => {
    const where = buildEligibilityWhere(regla, { email: "a@b.com", userId: null });
    assert.equal(where?.checkIns, undefined);
  });

  it("exige acreditación cuando la regla lo pide", () => {
    const where = buildEligibilityWhere(
      { ...regla, requireCheckIn: true },
      { email: "a@b.com", userId: null },
    );
    assert.deepEqual(where?.checkIns, { some: {} });
  });
});
