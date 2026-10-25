import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const agencyFindUnique = vi.fn();
const agencyCreate = vi.fn();
const agencyUpdate = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agency: {
      findUnique: (...a: unknown[]) => agencyFindUnique(...a),
      create: (...a: unknown[]) => agencyCreate(...a),
      update: (...a: unknown[]) => agencyUpdate(...a),
    },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET, PATCH, POST } from "./route";

const row = {
  id: 3, ownerUserId: 10, name: "Fotoshow", description: null, logoUrl: null, defaultCommissionBps: 3000,
  directoryListed: false, directoryLat: null, directoryLng: null, directoryRadiusKm: 50, directoryCity: null,
  notFoundSearchEnabled: false, termsText: null, termsVersion: 1,
};
const req = (body: unknown) => ({ json: async () => body }) as any;

beforeEach(() => {
  requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 10 } });
  agencyFindUnique.mockReset();
  agencyCreate.mockReset();
  agencyUpdate.mockReset();
});

describe("mi-agencia", () => {
  it("GET sin agencia devuelve null", async () => {
    agencyFindUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ agency: null });
    expect(requireAuth).toHaveBeenCalledWith(["PHOTOGRAPHER", "LAB_PHOTOGRAPHER"]);
  });
  it("sin sesión: 401", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    expect((await GET()).status).toBe(401);
  });
  it("POST crea con 30 % por defecto", async () => {
    agencyFindUnique.mockResolvedValue(null);
    agencyCreate.mockResolvedValue(row);
    const res = await POST(req({ name: "Fotoshow" }));
    expect(res.status).toBe(201);
    expect(agencyCreate.mock.calls[0][0].data).toMatchObject({ ownerUserId: 10, name: "Fotoshow", defaultCommissionBps: 3000 });
    const body = await res.json();
    expect(body.agency.defaultCommissionLabel).toBe("30 %");
    expect(body.agency.termsEffective).toContain("Al sumarte a esta agencia");
    expect(body.agency).not.toHaveProperty("ownerUserId");
  });
  it("POST si ya tiene agencia: 409", async () => {
    agencyFindUnique.mockResolvedValue(row);
    const res = await POST(req({ name: "Otra" }));
    expect(res.status).toBe(409);
    expect(agencyCreate).not.toHaveBeenCalled();
  });
  it("POST con datos inválidos: 400 con el mensaje", async () => {
    agencyFindUnique.mockResolvedValue(null);
    const res = await POST(req({ name: "X", defaultCommissionPercent: "150" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "El porcentaje tiene que estar entre 0 y 100." });
  });
  it("PATCH que cambia las condiciones sube la versión", async () => {
    agencyFindUnique.mockResolvedValue(row);
    agencyUpdate.mockResolvedValue({ ...row, termsText: "Nuevas", termsVersion: 2 });
    const res = await PATCH(req({ name: "Fotoshow", termsText: "Nuevas" }));
    expect(res.status).toBe(200);
    expect(agencyUpdate.mock.calls[0][0].data.termsVersion).toBe(2);
  });
  it("PATCH sin cambiar condiciones no sube la versión", async () => {
    agencyFindUnique.mockResolvedValue(row);
    agencyUpdate.mockResolvedValue(row);
    await PATCH(req({ name: "Fotoshow 2" }));
    expect(agencyUpdate.mock.calls[0][0].data.termsVersion).toBe(1);
  });
  it("PATCH sin agencia: 404", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect((await PATCH(req({ name: "X" }))).status).toBe(404);
  });
});
