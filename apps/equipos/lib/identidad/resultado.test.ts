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

describe("decideVerification con fila previa (DNI ya verificado)", () => {
  const dniOk = {
    providerRef: "x",
    outcome: "approved" as const,
    documentNumber: "30.123.456",
    legalName: "Ana Pérez",
  };
  const previa = (hash: string) => ({ documentHash: hash, documentLast3: "999", legalName: "Ana Vieja" });
  const mismoHash = decideVerification(dniOk, ctx).documentHash as string;

  it("rechazo o revisión conservan hash, últimos 3 y nombre previos", () => {
    for (const result of [
      { providerRef: "x", outcome: "rejected" as const, reason: "R" },
      { providerRef: "x", outcome: "review" as const },
      { providerRef: "x", outcome: "approved" as const },
    ]) {
      const r = decideVerification(result, { ...ctx, previous: previa("h".repeat(64)) });
      expect(r.documentHash).toBe("h".repeat(64));
      expect(r.documentLast3).toBe("999");
      expect(r.legalName).toBe("Ana Vieja");
    }
  });
  it("aprobado con el mismo hash previo queda APPROVED", () => {
    const r = decideVerification(dniOk, { ...ctx, previous: previa(mismoHash) });
    expect(r.status).toBe("APPROVED");
    expect(r.documentLast3).toBe("456");
  });
  it("aprobado con hash distinto al previo va a IN_REVIEW DNI_DISTINTO y conserva lo viejo", () => {
    const r = decideVerification(dniOk, { ...ctx, previous: previa("h".repeat(64)) });
    expect(r.status).toBe("IN_REVIEW");
    expect(r.rejectionReason).toBe("DNI_DISTINTO");
    expect(r.documentHash).toBe("h".repeat(64));
    expect(r.legalName).toBe("Ana Vieja");
  });
  it("DNI de otro usuario con fila previa: REJECTED sin tocar el hash previo", () => {
    const r = decideVerification(dniOk, { ...ctx, hashOwnerUserId: 2, previous: previa("h".repeat(64)) });
    expect(r.status).toBe("REJECTED");
    expect(r.rejectionReason).toBe("DNI_YA_USADO");
    expect(r.documentHash).toBe("h".repeat(64));
  });
});
