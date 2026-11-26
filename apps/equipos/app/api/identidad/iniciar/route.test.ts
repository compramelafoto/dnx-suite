import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  userFind: vi.fn(),
  phoneFind: vi.fn(),
  idFind: vi.fn(),
  upsert: vi.fn(),
}));
vi.mock("@repo/auth-guards", () => ({ getCurrentUser: m.getCurrentUser }));
vi.mock("@repo/db", () => ({
  prisma: {
    user: { findUnique: m.userFind },
    phoneVerification: { findUnique: m.phoneFind },
    identityVerification: { findUnique: m.idFind, upsert: m.upsert },
  },
}));

import { POST } from "./route";

function pedido(consent = true) {
  const fd = new FormData();
  if (consent) fd.set("consent", "on");
  return new Request("http://localhost/api/identidad/iniciar", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_PROVIDER", "simulado");
  m.getCurrentUser.mockResolvedValue({ id: 5 });
  m.userFind.mockResolvedValue({ emailVerifiedAt: new Date() });
  m.phoneFind.mockResolvedValue({ verifiedAt: new Date() });
  m.idFind.mockResolvedValue(null);
  m.upsert.mockResolvedValue({});
});

describe("POST /api/identidad/iniciar", () => {
  it("sin sesión -> 401", async () => {
    m.getCurrentUser.mockResolvedValue(null);
    expect((await POST(pedido())).status).toBe(401);
  });

  it("sin celular verificado -> 403", async () => {
    m.phoneFind.mockResolvedValue(null);
    expect((await POST(pedido())).status).toBe(403);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("sin consentimiento -> 400", async () => {
    expect((await POST(pedido(false))).status).toBe(400);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it.each([
    ["IN_REVIEW", { status: "IN_REVIEW", reverifyRequiredAt: null, reviewedById: null, rejectionReason: null }],
    ["REJECTED por admin", { status: "REJECTED", reverifyRequiredAt: null, reviewedById: 3, rejectionReason: "X" }],
    ["REJECTED DNI_YA_USADO", { status: "REJECTED", reverifyRequiredAt: null, reviewedById: null, rejectionReason: "DNI_YA_USADO" }],
    ["APPROVED vigente", { status: "APPROVED", reverifyRequiredAt: null, reviewedById: null, rejectionReason: null }],
  ])("%s -> 409 sin escrituras", async (_n, row) => {
    m.idFind.mockResolvedValue(row);
    expect((await POST(pedido())).status).toBe(409);
    expect(m.upsert).not.toHaveBeenCalled();
  });

  it("rechazo del proveedor permite reintentar", async () => {
    m.idFind.mockResolvedValue({
      status: "REJECTED",
      reverifyRequiredAt: null,
      reviewedById: null,
      rejectionReason: "DOC_ILEGIBLE",
    });
    const res = await POST(pedido());
    expect(res.status).toBe(303);
    expect(m.upsert).toHaveBeenCalledTimes(1);
  });
});
