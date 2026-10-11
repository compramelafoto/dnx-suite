import { describe, expect, it, vi } from "vitest";

/** Esta ruta no pide sesión (la usan muchas pantallas): nunca debe devolver los tokens de MP. */

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(async () => ({
        id: 7,
        name: "Ana",
        mpAccessToken: "APP_USR-token-real",
        mpRefreshToken: "TG-refresh-real",
        mpUserId: "123",
        defaultDigitalPhotoPrice: 1000,
      })),
    },
  },
}));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: vi.fn(async () => ({})) }));

import { GET } from "./route";

describe("GET /api/fotografo/[id]", () => {
  it("no devuelve los tokens de Mercado Pago, sólo si está conectado", async () => {
    const res = await GET(new Request("http://localhost/api/fotografo/7"), {
      params: Promise.resolve({ id: "7" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).not.toHaveProperty("mpAccessToken");
    expect(json).not.toHaveProperty("mpRefreshToken");
    expect(json.mpConnected).toBe(true);
  });
});
