import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Los tokens de Mercado Pago sólo los escribe el flujo OAuth y nunca viajan al navegador.
 * Antes este PATCH copiaba `mpAccessToken`/`mpRefreshToken`/`mpUserId`/`mpConnectedAt` del
 * cuerpo a la base y devolvía los tokens en la respuesta.
 */

const userFindUnique = vi.fn();
const userUpdate = vi.fn();
const getAuthUser = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => userFindUnique(...args),
      findFirst: vi.fn(async () => null),
      update: (...args: unknown[]) => userUpdate(...args),
    },
    lab: { findUnique: vi.fn(async () => null) },
    photographerProduct: { findFirst: vi.fn(), create: vi.fn() },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));
vi.mock("@/lib/auth", () => ({ getAuthUser: () => getAuthUser() }));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: vi.fn(async () => ({})) }));

import { PATCH } from "./route";

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request("http://localhost/api/fotografo/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

const MP_FIELDS = {
  mpAccessToken: "APP_USR-token-de-otra-cuenta",
  mpRefreshToken: "TG-refresh-de-otra-cuenta",
  mpUserId: "999999",
  mpConnectedAt: "2026-10-11T12:00:00.000Z",
};

describe("PATCH /api/fotografo/update y la conexión con Mercado Pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    getAuthUser.mockResolvedValue({ id: 7, role: "PHOTOGRAPHER" });
    userUpdate.mockImplementation(async ({ where }: { where: { id: number } }) => ({
      id: where.id,
      name: "Ana",
    }));
    userFindUnique.mockImplementation(async ({ select }: { select: Record<string, boolean> }) => {
      if (select.mpAccessToken) {
        // Lo que hay guardado en la base: tokens reales, puestos por el flujo OAuth.
        return {
          mpAccessToken: "APP_USR-token-real",
          mpRefreshToken: "TG-refresh-real",
          mpUserId: "123",
          mpConnectedAt: new Date("2026-01-01T00:00:00.000Z"),
        };
      }
      return { role: "PHOTOGRAPHER" };
    });
  });

  it("ignora los campos de Mercado Pago que vienen en el cuerpo", async () => {
    const res = await patch({ name: "Ana", ...MP_FIELDS });

    expect(res.status).toBe(200);
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const data = userUpdate.mock.calls[0][0].data;
    expect(data.name).toBe("Ana");
    for (const field of Object.keys(MP_FIELDS)) {
      expect(data).not.toHaveProperty(field);
    }
  });

  it("si el cuerpo sólo trae campos de Mercado Pago, no escribe nada", async () => {
    const res = await patch(MP_FIELDS);

    expect(res.status).toBe(400);
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("la respuesta no incluye los tokens y avisa si está conectado", async () => {
    const res = await patch({ name: "Ana" });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).not.toHaveProperty("mpAccessToken");
    expect(json).not.toHaveProperty("mpRefreshToken");
    expect(JSON.stringify(json)).not.toContain("APP_USR-token-real");
    expect(JSON.stringify(json)).not.toContain("TG-refresh-real");
    expect(json.mpConnected).toBe(true);
    expect(json.mpUserId).toBe("123");
  });

  it("tampoco pide el token de refresco a la base", async () => {
    await patch({ name: "Ana" });

    const selects = userFindUnique.mock.calls.map((c) => c[0].select);
    for (const select of selects) {
      expect(select).not.toHaveProperty("mpRefreshToken");
    }
  });
});
