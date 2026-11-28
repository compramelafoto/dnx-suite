import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  isSuperAdmin: vi.fn(),
  idFind: vi.fn(),
  idFindFirst: vi.fn(),
  idUpdateMany: vi.fn(),
  userFind: vi.fn(),
  send: vi.fn(),
}));
vi.mock("@repo/auth-guards", () => ({
  getCurrentUser: m.getCurrentUser,
  isSuperAdmin: m.isSuperAdmin,
}));
vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUnique: m.userFind },
    identityVerification: {
      findUnique: m.idFind,
      findFirst: m.idFindFirst,
      updateMany: m.idUpdateMany,
    },
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: m.send }));

import { POST } from "./route";

const ctx = { params: Promise.resolve({ id: "7" }) };
function pedido(body: unknown) {
  return new Request("http://localhost/api/admin/verificaciones/7", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_DNI_PEPPER", "pepper");
  m.getCurrentUser.mockResolvedValue({ id: 1 });
  m.isSuperAdmin.mockResolvedValue(true);
  m.idFind.mockResolvedValue({
    id: 7,
    userId: 5,
    status: "IN_REVIEW",
    providerRef: "ref-1",
    documentHash: null,
    documentLast3: null,
    legalName: null,
  });
  m.idFindFirst.mockResolvedValue(null);
  m.idUpdateMany.mockResolvedValue({ count: 1 });
  m.userFind.mockResolvedValue({ email: "a@b.com", name: "Ana" });
});

describe("POST /api/admin/verificaciones/[id]", () => {
  it("sin sesión -> 401", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await POST(pedido({ action: "reject", reason: "x" }), ctx)).status).toBe(401);
  });

  it("no admin -> 403 sin escrituras", async () => {
    m.isSuperAdmin.mockResolvedValue(false);
    expect((await POST(pedido({ action: "reject", reason: "x" }), ctx)).status).toBe(403);
    expect(m.idUpdateMany).not.toHaveBeenCalled();
  });

  it("aprobar con un DNI ya usado por otro -> 409 y sigue IN_REVIEW", async () => {
    m.idFindFirst.mockResolvedValue({ userId: 99 });
    const res = await POST(
      pedido({ action: "approve", documentNumber: "30.111.222", legalName: "Ana Pérez" }),
      ctx,
    );
    expect(res.status).toBe(409);
    expect(m.idUpdateMany).not.toHaveBeenCalled();
    expect(m.send).not.toHaveBeenCalled();
  });

  it("aprobar sin DNI o nombre -> 400", async () => {
    expect((await POST(pedido({ action: "approve", legalName: "Ana" }), ctx)).status).toBe(400);
    expect(m.idUpdateMany).not.toHaveBeenCalled();
  });

  it("aprobar ok guarda reviewedById y avisa", async () => {
    const res = await POST(
      pedido({ action: "approve", documentNumber: "30111222", legalName: "Ana Pérez" }),
      ctx,
    );
    expect(res.status).toBe(200);
    const arg = m.idUpdateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: 7, status: "IN_REVIEW" });
    expect(arg.data).toMatchObject({
      status: "APPROVED",
      reviewedById: 1,
      reverifyRequiredAt: null,
      documentLast3: "222",
      legalName: "Ana Pérez",
    });
    expect(m.send).toHaveBeenCalledWith("a@b.com", "verificacion_aprobada", expect.anything());
  });

  it("rechazar exige motivo -> 400", async () => {
    expect((await POST(pedido({ action: "reject", reason: "  " }), ctx)).status).toBe(400);
  });

  it("rechazar guarda motivo y reviewedById", async () => {
    const res = await POST(pedido({ action: "reject", reason: "Foto borrosa" }), ctx);
    expect(res.status).toBe(200);
    expect(m.idUpdateMany.mock.calls[0][0].data).toMatchObject({
      status: "REJECTED",
      rejectionReason: "Foto borrosa",
      reviewedById: 1,
    });
    expect(m.send).toHaveBeenCalledWith("a@b.com", "verificacion_rechazada", expect.anything());
  });

  it("fila que no está IN_REVIEW -> 409", async () => {
    m.idFind.mockResolvedValue({ id: 7, userId: 5, status: "APPROVED", providerRef: "r" });
    expect((await POST(pedido({ action: "reject", reason: "x" }), ctx)).status).toBe(409);
    expect(m.idUpdateMany).not.toHaveBeenCalled();
  });

  it("decisión simultánea (count 0) -> 409 sin correo", async () => {
    m.idUpdateMany.mockResolvedValue({ count: 0 });
    expect((await POST(pedido({ action: "reject", reason: "x" }), ctx)).status).toBe(409);
    expect(m.send).not.toHaveBeenCalled();
  });
});
