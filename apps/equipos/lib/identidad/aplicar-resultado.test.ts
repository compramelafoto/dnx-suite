import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  userFind: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    identityVerification: { findUnique: m.findUnique, findFirst: m.findFirst, update: m.update },
    user: { findUnique: m.userFind },
  },
}));
vi.mock("../correo", () => ({ sendPortalEmail: m.send }));

import { applyProviderResult } from "./aplicar-resultado";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_DNI_PEPPER", "pimienta");
  vi.stubEnv("ADMIN_EMAIL", "admin@dnx.test");
  m.update.mockResolvedValue({});
  m.send.mockResolvedValue({ success: true });
  m.userFind.mockResolvedValue({ email: "u@x.com", name: "U" });
  m.findFirst.mockResolvedValue(null);
});

describe("applyProviderResult", () => {
  it("providerRef desconocido -> unknown_ref, sin escrituras", async () => {
    m.findUnique.mockResolvedValue(null);
    expect(await applyProviderResult({ providerRef: "x", outcome: "approved" })).toBe("unknown_ref");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("fila ya APPROVED o REJECTED -> already_final", async () => {
    for (const status of ["APPROVED", "REJECTED"]) {
      m.findUnique.mockResolvedValue({ id: 1, userId: 5, status });
      expect(await applyProviderResult({ providerRef: "x", outcome: "approved" })).toBe("already_final");
    }
    expect(m.update).not.toHaveBeenCalled();
  });

  it("aprobado: guarda con un solo update y avisa al usuario", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    const r = await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12.345.678",
      legalName: "Ana Pérez",
    });
    expect(r).toBe("applied");
    expect(m.update).toHaveBeenCalledTimes(1);
    const data = m.update.mock.calls[0][0].data;
    expect(data.status).toBe("APPROVED");
    expect(data.documentLast3).toBe("678");
    expect(data.approvedAt).toBeInstanceOf(Date);
    expect(m.send).toHaveBeenCalledWith("u@x.com", "verificacion_aprobada", expect.any(Object));
  });

  it("aprobado limpia reverifyRequiredAt", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING", reverifyRequiredAt: new Date() });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "Ana Pérez",
    });
    expect(m.update.mock.calls[0][0].data.reverifyRequiredAt).toBeNull();
  });

  it("el dueño del hash se busca sin filtrar por estado y excluyendo al propio usuario", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "Ana Pérez",
    });
    const where = m.findFirst.mock.calls[0][0].where;
    expect(where.status).toBeUndefined();
    expect(where.userId).toEqual({ not: 5 });
  });

  it("hash de otro usuario en cualquier estado -> REJECTED DNI_YA_USADO sin pisar el hash previo", async () => {
    m.findUnique.mockResolvedValue({
      id: 1,
      userId: 5,
      status: "PENDING",
      documentHash: "h".repeat(64),
      documentLast3: "999",
      legalName: "Ana Vieja",
    });
    m.findFirst.mockResolvedValue({ userId: 9 });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "Ana Pérez",
    });
    const data = m.update.mock.calls[0][0].data;
    expect(data.status).toBe("REJECTED");
    expect(data.rejectionReason).toBe("DNI_YA_USADO");
    expect(data.documentHash).toBe("h".repeat(64));
    expect(data.reverifyRequiredAt).toBeUndefined();
  });

  it("fila con hash previo y DNI distinto -> IN_REVIEW DNI_DISTINTO", async () => {
    m.findUnique.mockResolvedValue({
      id: 1,
      userId: 5,
      status: "PENDING",
      documentHash: "h".repeat(64),
      documentLast3: "999",
      legalName: "Ana Vieja",
    });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "Ana Pérez",
    });
    const data = m.update.mock.calls[0][0].data;
    expect(data.status).toBe("IN_REVIEW");
    expect(data.rejectionReason).toBe("DNI_DISTINTO");
    expect(data.legalName).toBe("Ana Vieja");
  });

  it("el correo al admin apunta a /admin/verificaciones", async () => {
    vi.stubEnv("APP_URL", "https://e.test");
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    await applyProviderResult({ providerRef: "x", outcome: "review" });
    expect(m.send.mock.calls[0][2].url).toBe("https://e.test/admin/verificaciones");
  });

  it("decisión del proveedor limpia reviewedById", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING", reviewedById: 3 });
    await applyProviderResult({ providerRef: "x", outcome: "rejected", reason: "DOC_ILEGIBLE" });
    expect(m.update.mock.calls[0][0].data.reviewedById).toBeNull();
  });

  it("rechazo: el correo muestra una frase en español, no el código", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    m.findFirst.mockResolvedValue({ userId: 9 });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "A B",
    });
    const motivo = m.send.mock.calls[0][2].motivo as string;
    expect(motivo).toBe("Ese DNI ya está verificado en otra cuenta");
    expect(motivo).not.toContain("DNI_YA_USADO");
  });

  it("rechazo con motivo desconocido del proveedor -> frase genérica", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    await applyProviderResult({ providerRef: "x", outcome: "rejected", reason: "DOC_ILEGIBLE" });
    expect(m.send.mock.calls[0][2].motivo).toBe(
      "No pudimos confirmar tu identidad con las imágenes enviadas.",
    );
  });

  it("DNI ya usado por otro usuario -> rechazado", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    m.findFirst.mockResolvedValue({ userId: 9 });
    await applyProviderResult({
      providerRef: "x",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "A B",
    });
    expect(m.update.mock.calls[0][0].data.status).toBe("REJECTED");
    expect(m.update.mock.calls[0][0].data.rejectionReason).toBe("DNI_YA_USADO");
    expect(m.send).toHaveBeenCalledWith("u@x.com", "verificacion_rechazada", expect.any(Object));
  });

  it("en revisión: avisa al admin, no al usuario", async () => {
    m.findUnique.mockResolvedValue({ id: 1, userId: 5, status: "PENDING" });
    await applyProviderResult({ providerRef: "x", outcome: "review" });
    expect(m.update.mock.calls[0][0].data.status).toBe("IN_REVIEW");
    expect(m.send).toHaveBeenCalledTimes(1);
    expect(m.send).toHaveBeenCalledWith("admin@dnx.test", "verificacion_en_revision_admin", expect.any(Object));
  });
});
