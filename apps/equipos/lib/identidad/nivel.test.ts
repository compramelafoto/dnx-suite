import { describe, expect, it } from "vitest";
import { computeLevel } from "./nivel";

const d = new Date("2026-01-01");

describe("computeLevel", () => {
  it("sin correo verificado", () => {
    expect(computeLevel({ emailVerifiedAt: null, phoneVerifiedAt: d, identity: null })).toBe("sin_correo");
  });
  it("registrado", () => {
    expect(computeLevel({ emailVerifiedAt: d, phoneVerifiedAt: null, identity: null })).toBe("registrado");
  });
  it("teléfono", () => {
    expect(computeLevel({ emailVerifiedAt: d, phoneVerifiedAt: d, identity: null })).toBe("telefono");
  });
  it("identidad aprobada con teléfono", () => {
    expect(
      computeLevel({ emailVerifiedAt: d, phoneVerifiedAt: d, identity: { status: "APPROVED", reverifyRequiredAt: null } }),
    ).toBe("identidad");
  });
  it("identidad aprobada con reverificación pendiente baja a teléfono", () => {
    expect(
      computeLevel({ emailVerifiedAt: d, phoneVerifiedAt: d, identity: { status: "APPROVED", reverifyRequiredAt: d } }),
    ).toBe("telefono");
  });
  it("identidad aprobada pero sin teléfono verificado queda registrado", () => {
    expect(
      computeLevel({ emailVerifiedAt: d, phoneVerifiedAt: null, identity: { status: "APPROVED", reverifyRequiredAt: null } }),
    ).toBe("registrado");
  });
});
