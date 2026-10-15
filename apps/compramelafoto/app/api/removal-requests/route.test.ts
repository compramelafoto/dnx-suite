import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ photo: vi.fn(), existing: vi.fn(), create: vi.fn(), rl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { findUnique: (...a: unknown[]) => m.photo(...a) },
    removalRequest: {
      findFirst: (...a: unknown[]) => m.existing(...a),
      create: (...a: unknown[]) => m.create(...a),
    },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => m.rl(...a) }));
import { POST } from "./route";
import type { NextRequest } from "next/server";

const BODY = {
  albumId: 10,
  photoId: 99,
  requesterName: "Juana Pérez",
  requesterEmail: "Juana@Mail.com",
  requesterPhone: "3415551234",
  reason: "Aparezco yo y no quiero que se venda",
  declarationOk: true,
};
const req = (body: unknown) =>
  new Request("http://x/api/removal-requests", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "x-forwarded-for": "1.2.3.4" },
  }) as unknown as NextRequest;
const FOTO = { id: 99, albumId: 10, isRemoved: false, album: { userId: 7 } };

beforeEach(() => {
  m.photo.mockReset();
  m.existing.mockReset();
  m.create.mockReset();
  m.rl.mockReset();
  m.rl.mockReturnValue({ allowed: true });
});

describe("POST /api/removal-requests", () => {
  it("rate limit → 429 con la clave por IP", async () => {
    m.rl.mockReturnValue({ allowed: false });
    const r = await POST(req(BODY));
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "Demasiadas solicitudes. Intentá más tarde." });
    expect(m.rl).toHaveBeenCalledWith({ key: "removal:1.2.3.4", limit: 10, windowMs: 3600000 });
  });
  it("body inválido → 400 de sanitize sin consultar", async () => {
    const r = await POST(req({ ...BODY, reason: "corto" }));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "El motivo es requerido (mínimo 10 caracteres)" });
    expect(m.photo).not.toHaveBeenCalled();
  });
  it("foto inexistente → 404", async () => {
    m.photo.mockResolvedValue(null);
    const r = await POST(req(BODY));
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "La foto no existe" });
  });
  it("foto de otro álbum → 400", async () => {
    m.photo.mockResolvedValue({ ...FOTO, albumId: 11 });
    const r = await POST(req(BODY));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "La foto no pertenece a este álbum" });
  });
  it("foto removida → 400", async () => {
    m.photo.mockResolvedValue({ ...FOTO, isRemoved: true });
    const r = await POST(req(BODY));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "La foto ya no está disponible" });
  });
  it("solicitud pendiente duplicada → 200 con duplicate", async () => {
    m.photo.mockResolvedValue(FOTO);
    m.existing.mockResolvedValue({ id: 3, createdAt: new Date() });
    const r = await POST(req(BODY));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      success: true,
      message: "Ya tenemos una solicitud pendiente para esta foto.",
      requestId: 3,
      duplicate: true,
    });
    expect(m.existing.mock.calls[0][0].where).toEqual({
      albumId: 10,
      photoId: 99,
      requesterEmail: "juana@mail.com",
      status: "PENDING",
    });
    expect(m.create).not.toHaveBeenCalled();
  });
  it("nueva → 201 con photographerId del dueño del álbum", async () => {
    m.photo.mockResolvedValue(FOTO);
    m.existing.mockResolvedValue(null);
    m.create.mockResolvedValue({ id: 4, createdAt: new Date() });
    const r = await POST(req(BODY));
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({
      success: true,
      message: "Recibimos tu solicitud. El fotógrafo la revisará.",
      requestId: 4,
    });
    expect(m.create.mock.calls[0][0].data).toEqual({
      albumId: 10,
      photoId: 99,
      photographerId: 7,
      requesterName: "Juana Pérez",
      requesterEmail: "juana@mail.com",
      requesterPhone: "3415551234",
      reason: "Aparezco yo y no quiero que se venda",
      declarationOk: true,
      status: "PENDING",
    });
  });
  it("error de base → 500 genérico", async () => {
    m.photo.mockRejectedValue(new Error("db"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req(BODY));
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "Error al procesar la solicitud" });
    spy.mockRestore();
  });
});
