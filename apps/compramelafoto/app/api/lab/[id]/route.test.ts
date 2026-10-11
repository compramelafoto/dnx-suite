import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `/api/lab/[id]` la usa también la página pública de impresión, así que el GET no pide sesión:
 * por eso nunca debe devolver los tokens de Mercado Pago. El PATCH no pedía sesión y además
 * copiaba los tokens del cuerpo: cualquiera podía apuntar los cobros de un laboratorio a otra
 * cuenta de Mercado Pago.
 */

const labFindUnique = vi.fn();
const labUpdate = vi.fn();
const getAuthUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    lab: {
      findUnique: (...args: unknown[]) => labFindUnique(...args),
      findFirst: vi.fn(async () => null),
      update: (...args: unknown[]) => labUpdate(...args),
    },
    user: { update: vi.fn(), findUnique: vi.fn() },
    labProduct: { findFirst: vi.fn(), create: vi.fn() },
  },
  Role: { ADMIN: "ADMIN", LAB: "LAB" },
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => getAuthUser() }));
vi.mock("@/lib/r2-client", () => ({ getR2PublicUrl: (key: string) => `https://r2.test/${key}` }));

import { GET, PATCH } from "./route";

const ctx = { params: Promise.resolve({ id: "5" }) };
const STORED = { mpAccessToken: "APP_USR-token-real", mpRefreshToken: "TG-refresh-real", mpUserId: "123" };

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/lab/5", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
    ctx,
  );
}

describe("/api/lab/[id] y los tokens de Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    labFindUnique.mockImplementation(async ({ select }: { select: Record<string, unknown> }) =>
      select.userId ? { userId: 70 } : { id: 5, name: "Lab", logoUrl: null, ...STORED },
    );
    labUpdate.mockImplementation(async () => ({ id: 5, name: "Lab nuevo", ...STORED }));
  });

  it("GET no devuelve los tokens", async () => {
    const res = await GET(new Request("http://localhost/api/lab/5") as never, ctx);
    const json = await res.json();

    expect(json).not.toHaveProperty("mpAccessToken");
    expect(json).not.toHaveProperty("mpRefreshToken");
    expect(json.mpConnected).toBe(true);
  });

  it("PATCH sin sesión se rechaza", async () => {
    getAuthUser.mockResolvedValue(null);
    const res = await patch({ name: "x" });
    expect(res.status).toBe(401);
    expect(labUpdate).not.toHaveBeenCalled();
  });

  it("PATCH de alguien que no es el dueño se rechaza", async () => {
    getAuthUser.mockResolvedValue({ id: 99, role: "LAB" });
    const res = await patch({ name: "x" });
    expect(res.status).toBe(403);
    expect(labUpdate).not.toHaveBeenCalled();
  });

  it("PATCH del dueño ignora los campos de Mercado Pago y no devuelve tokens", async () => {
    getAuthUser.mockResolvedValue({ id: 70, role: "LAB" });
    const res = await patch({
      name: "Lab nuevo",
      mpAccessToken: "APP_USR-otra-cuenta",
      mpRefreshToken: "TG-otra-cuenta",
      mpUserId: "999",
      mpConnectedAt: "2026-10-11T12:00:00.000Z",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    const data = labUpdate.mock.calls[0][0].data;
    expect(data.name).toBe("Lab nuevo");
    for (const f of ["mpAccessToken", "mpRefreshToken", "mpUserId", "mpConnectedAt"]) {
      expect(data).not.toHaveProperty(f);
    }
    expect(JSON.stringify(json)).not.toContain("APP_USR");
    expect(JSON.stringify(json)).not.toContain("TG-");
    expect(json.mpConnected).toBe(true);
  });
});
