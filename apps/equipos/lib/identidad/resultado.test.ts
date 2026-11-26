import { describe, expect, it } from "vitest";
import { decideVerification } from "./resultado";

const ctx = { userId: 1, hashOwnerUserId: null, pepper: "pimienta" };

describe("decideVerification", () => {
  it("aprobado con DNI de otro usuario se rechaza", () => {
    const r = decideVerification(
      { providerRef: "x", outcome: "approved", documentNumber: "30.123.456", legalName: "Ana Pérez" },
      { ...ctx, hashOwnerUserId: 2 },
    );
    expect(r.status).toBe("REJECTED");
    expect(r.rejectionReason).toBe("DNI_YA_USADO");
  });
  it("aprobado con el mismo usuario o sin dueño queda APPROVED", () => {
    for (const hashOwnerUserId of [1, null]) {
      const r = decideVerification(
        { providerRef: "x", outcome: "approved", documentNumber: "30.123.456", legalName: "  Ana Pérez " },
        { ...ctx, hashOwnerUserId },
      );
      expect(r.status).toBe("APPROVED");
      expect(r.documentLast3).toBe("456");
      expect(r.legalName).toBe("Ana Pérez");
      expect(r.documentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(r.rejectionReason).toBeNull();
    }
  });
  it("aprobado sin DNI, sin nombre o con DNI inválido va a revisión", () => {
    const base = { providerRef: "x", outcome: "approved" as const };
    expect(decideVerification({ ...base, legalName: "Ana" }, ctx).status).toBe("IN_REVIEW");
    expect(decideVerification({ ...base, documentNumber: "30123456" }, ctx).status).toBe("IN_REVIEW");
    expect(decideVerification({ ...base, documentNumber: "12", legalName: "Ana" }, ctx).status).toBe("IN_REVIEW");
  });
  it("review va a IN_REVIEW", () => {
    expect(decideVerification({ providerRef: "x", outcome: "review" }, ctx).status).toBe("IN_REVIEW");
  });
  it("rejected queda REJECTED con el motivo", () => {
    const r = decideVerification({ providerRef: "x", outcome: "rejected", reason: "DOC_ILEGIBLE" }, ctx);
    expect(r.status).toBe("REJECTED");
    expect(r.rejectionReason).toBe("DOC_ILEGIBLE");
    expect(r.documentHash).toBeNull();
  });
});
