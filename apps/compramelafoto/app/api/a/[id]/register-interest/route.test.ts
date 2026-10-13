import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  album: vi.fn(),
  interest: vi.fn(),
  notif: vi.fn(),
  rl: vi.fn(),
  deny: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    album: { findUnique: (...a: unknown[]) => m.album(...a) },
    albumInterest: { upsert: (...a: unknown[]) => m.interest(...a) },
    albumNotification: { upsert: (...a: unknown[]) => m.notif(...a) },
  },
}));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: (...a: unknown[]) => m.rl(...a) }));
vi.mock("@/lib/r2-client", () => ({ uploadToR2: vi.fn(), generateR2Key: vi.fn(), deleteFromR2: vi.fn() }));
vi.mock("@/lib/faces/rekognition", () => ({ indexFaces: vi.fn() }));
vi.mock("sharp", () => ({ default: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthUser: async () => null }));
vi.mock("@/lib/public-album-test-access", () => ({
  denyIfTestAlbumNotOwnerPreview: (...a: unknown[]) => m.deny(...a),
}));
import { POST } from "./route";
import type { NextRequest } from "next/server";

const campos = (extra: Record<string, string> = {}) => {
  const fd = new FormData();
  const base: Record<string, string> = {
    name: "Juana",
    lastName: "Pérez",
    whatsapp: "3415551234",
    email: "Juana@Mail.com",
    termsAccepted: "true",
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
};
const req = (fd: FormData) =>
  new Request("http://x/api/a/10/register-interest", {
    method: "POST",
    body: fd,
    headers: { "x-forwarded-for": "1.2.3.4" },
  }) as unknown as NextRequest;
const params = (id = "10") => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  m.album.mockReset();
  m.interest.mockReset();
  m.notif.mockReset();
  m.rl.mockReset();
  m.deny.mockReset();
  m.rl.mockReturnValue({ allowed: true });
  m.deny.mockResolvedValue(null);
  m.album.mockResolvedValue({ id: 10, userId: 7, isTest: false });
  m.interest.mockResolvedValue({ id: 55 });
  m.notif.mockResolvedValue({});
});

describe("POST /api/a/[id]/register-interest (sin selfie)", () => {
  it("id inválido → 400", async () => {
    const r = await POST(req(campos()), params("abc"));
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "ID de álbum inválido" });
  });
  it("rate limit → 429 por álbum e IP", async () => {
    m.rl.mockReturnValue({ allowed: false });
    const r = await POST(req(campos()), params());
    expect(r.status).toBe(429);
    expect(await r.json()).toEqual({ error: "Demasiados intentos. Intentá de nuevo en un minuto." });
    expect(m.rl).toHaveBeenCalledWith({ key: "register-interest:10:1.2.3.4", limit: 10, windowMs: 60000 });
  });
  it("sin whatsapp → 400 «WhatsApp es requerido»", async () => {
    const r = await POST(req(campos({ whatsapp: "  " })), params());
    expect(r.status).toBe(400);
    expect(await r.json()).toEqual({ error: "WhatsApp es requerido" });
    expect(m.interest).not.toHaveBeenCalled();
  });
  it("álbum inexistente → 404", async () => {
    m.album.mockResolvedValue(null);
    const r = await POST(req(campos()), params());
    expect(r.status).toBe(404);
    expect(await r.json()).toEqual({ error: "Álbum no encontrado" });
  });
  it("ok → upsert de interés con whatsapp y de notificación; mensaje sin biometría", async () => {
    const r = await POST(req(campos()), params());
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      ok: true,
      message: "Registro exitoso. Te avisaremos cuando las fotos estén disponibles.",
      interestId: 55,
      hasBiometric: false,
    });
    const i = m.interest.mock.calls[0][0];
    expect(i.where).toEqual({ albumId_email: { albumId: 10, email: "juana@mail.com" } });
    expect(i.update).toEqual({ name: "Juana", firstName: "Juana", lastName: "Pérez", whatsapp: "3415551234" });
    expect(i.create).toEqual({
      albumId: 10,
      email: "juana@mail.com",
      name: "Juana",
      firstName: "Juana",
      lastName: "Pérez",
      whatsapp: "3415551234",
      biometricConsent: false,
      biometricConsentAt: null,
      selfieKey: null,
      faceId: null,
      expiresAt: expect.any(Date),
    });
    const dias = (i.create.expiresAt.getTime() - Date.now()) / 86400000;
    expect(dias).toBeGreaterThan(89.9);
    expect(dias).toBeLessThan(90.1);
    const n = m.notif.mock.calls[0][0];
    expect(n.where).toEqual({ albumId_email: { albumId: 10, email: "juana@mail.com" } });
    expect(n.update).toEqual({ name: "Juana", lastName: "Pérez", whatsapp: "3415551234" });
    expect(n.create).toEqual({
      albumId: 10,
      email: "juana@mail.com",
      name: "Juana",
      lastName: "Pérez",
      whatsapp: "3415551234",
      notifiedWhenReady: false,
      notifiedAt3Weeks: false,
      notifiedAt2Weeks: false,
      notifiedAt1Week: false,
    });
  });
  it("sin apellido → lastName null en los dos modelos", async () => {
    await POST(req(campos({ lastName: "" })), params());
    expect(m.interest.mock.calls[0][0].update.lastName).toBeNull();
    expect(m.interest.mock.calls[0][0].create.lastName).toBeNull();
    expect(m.notif.mock.calls[0][0].update.lastName).toBeNull();
    expect(m.notif.mock.calls[0][0].create.lastName).toBeNull();
  });
  it("si falla la notificación igual responde ok", async () => {
    m.notif.mockRejectedValue(new Error("x"));
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await POST(req(campos()), params());
    expect(r.status).toBe(200);
    expect((await r.json()).interestId).toBe(55);
    spy.mockRestore();
  });
  it("si falla el interés → 500 con el mensaje del error", async () => {
    m.interest.mockRejectedValue(new Error("db caída"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await POST(req(campos()), params());
    expect(r.status).toBe(500);
    expect(await r.json()).toEqual({ error: "db caída" });
    spy.mockRestore();
  });
});
