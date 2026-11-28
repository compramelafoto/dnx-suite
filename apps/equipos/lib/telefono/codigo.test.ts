import { describe, expect, it } from "vitest";
import { buildWhatsappLink, extractCode, generatePhoneCode, matchPhoneVerification } from "./codigo";

const now = new Date("2026-11-25T12:00:00Z");
const pending = {
  phone: "341 555-1234",
  code: "EQ-123456",
  codeExpiresAt: new Date("2026-11-25T12:10:00Z"),
  verifiedAt: null as Date | null,
};

describe("generatePhoneCode", () => {
  it("EQ- más 6 dígitos", () => {
    for (let i = 0; i < 50; i++) expect(generatePhoneCode()).toMatch(/^EQ-\d{6}$/);
  });
});

describe("buildWhatsappLink", () => {
  it("arma el enlace con el código codificado", () => {
    expect(buildWhatsappLink("5493415550000", "EQ-123456")).toBe("https://wa.me/5493415550000?text=EQ-123456");
  });
});

describe("extractCode", () => {
  it("lo encuentra en cualquier parte", () => {
    expect(extractCode("hola EQ-123456 gracias")).toBe("EQ-123456");
  });
  it("sin código -> null", () => {
    expect(extractCode("hola")).toBeNull();
    expect(extractCode("EQ-12345")).toBeNull();
  });
});

describe("matchPhoneVerification", () => {
  it("correcto (número en otro formato) -> true", () => {
    expect(matchPhoneVerification({ fromPhone: "5493415551234", text: "EQ-123456", now, pending })).toBe(true);
    expect(
      matchPhoneVerification({
        fromPhone: "543415551234",
        text: "hola EQ-123456",
        now,
        pending: { ...pending, phone: "+54 9 341 5551234" },
      }),
    ).toBe(true);
  });
  it("código correcto desde otro número -> false", () => {
    expect(matchPhoneVerification({ fromPhone: "5493419999999", text: "EQ-123456", now, pending })).toBe(false);
  });
  it("código equivocado -> false", () => {
    expect(matchPhoneVerification({ fromPhone: "5493415551234", text: "EQ-654321", now, pending })).toBe(false);
  });
  it("vencido -> false", () => {
    expect(
      matchPhoneVerification({ fromPhone: "5493415551234", text: "EQ-123456", now: new Date("2026-11-25T12:11:00Z"), pending }),
    ).toBe(false);
  });
  it("ya verificado -> false", () => {
    expect(
      matchPhoneVerification({ fromPhone: "5493415551234", text: "EQ-123456", now, pending: { ...pending, verifiedAt: new Date() } }),
    ).toBe(false);
  });
});
