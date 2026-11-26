import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  userFind: vi.fn(),
}));
vi.mock("@repo/db", () => ({
  prisma: {
    identityVerification: {
      findUnique: m.findUnique,
      findFirst: m.findFirst,
      update: m.update,
      upsert: m.upsert,
      create: m.create,
      delete: m.delete,
    },
    user: { findUnique: m.userFind },
  },
}));
vi.mock("@/lib/correo", () => ({ sendPortalEmail: vi.fn().mockResolvedValue({ success: true }) }));

import { POST } from "./route";

const SECRET = "secreto-de-prueba";
const firmar = (b: string) => createHmac("sha256", SECRET).update(b).digest("hex");
function pedido(body: string, sig?: string) {
  return new Request("http://localhost/api/identidad/webhook", {
    method: "POST",
    body,
    headers: sig ? { "x-signature": sig } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("IDENTITY_PROVIDER", "simulado");
  vi.stubEnv("IDENTITY_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("IDENTITY_DNI_PEPPER", "pimienta");
  m.update.mockResolvedValue({});
  m.findFirst.mockResolvedValue(null);
  m.userFind.mockResolvedValue({ email: "u@x.com", name: "U" });
});

describe("POST /api/identidad/webhook", () => {
  it("firma inválida -> 401 y sin escrituras", async () => {
    const body = JSON.stringify({ providerRef: "r1", outcome: "approved" });
    for (const sig of [undefined, "abc", "0".repeat(64)]) {
      const res = await POST(pedido(body, sig));
      expect(res.status).toBe(401);
    }
    for (const k of ["update", "upsert", "create", "delete"] as const) {
      expect(m[k]).not.toHaveBeenCalled();
    }
  });

  it("providerRef desconocido -> 200 con unknown_ref", async () => {
    m.findUnique.mockResolvedValue(null);
    const body = JSON.stringify({ providerRef: "nope", outcome: "approved" });
    const res = await POST(pedido(body, firmar(body)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ result: "unknown_ref" });
  });

  it("mismo resultado dos veces -> la segunda already_final", async () => {
    const body = JSON.stringify({
      providerRef: "r1",
      outcome: "approved",
      documentNumber: "12345678",
      legalName: "Ana Pérez",
    });
    m.findUnique.mockResolvedValueOnce({ id: 1, userId: 5, status: "PENDING" });
    const a = await POST(pedido(body, firmar(body)));
    expect(await a.json()).toEqual({ result: "applied" });
    m.findUnique.mockResolvedValueOnce({ id: 1, userId: 5, status: "APPROVED" });
    const b = await POST(pedido(body, firmar(body)));
    expect(await b.json()).toEqual({ result: "already_final" });
    expect(m.update).toHaveBeenCalledTimes(1);
  });
});
