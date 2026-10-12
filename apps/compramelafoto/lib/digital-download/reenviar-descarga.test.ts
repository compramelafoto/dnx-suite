import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ token: vi.fn(), create: vi.fn(), resend: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { orderDownloadToken: { findFirst: (...a: unknown[]) => m.token(...a) } },
}));
vi.mock("@/lib/download-tokens", () => ({ createClientDownloadToken: (...a: unknown[]) => m.create(...a) }));
vi.mock("@/lib/zip-job-notifications", () => ({
  resendDigitalDownloadEmailForOrder: (...a: unknown[]) => m.resend(...a),
}));
vi.mock("@/lib/services/settingsService", () => ({ getAppConfig: async () => ({ downloadLinkDays: 15 }) }));
import { albumConOriginales, reenviarDescargaDePedido } from "./reenviar-descarga";

const o = { id: 5, albumId: 3 };
beforeEach(() => {
  Object.values(m).forEach((f) => f.mockReset());
});

describe("reenviarDescargaDePedido", () => {
  it("con token vigente no crea otro y reenvía con la clave dada", async () => {
    m.token.mockResolvedValue({ id: 1 });
    m.resend.mockResolvedValue({ queued: true });
    expect(await reenviarDescargaDePedido(o, "clave-1")).toEqual({ ok: true, renovado: false });
    expect(m.token.mock.calls[0]![0].where).toMatchObject({ orderId: 5, type: "CLIENT_DIGITAL", photoId: null });
    expect(m.create).not.toHaveBeenCalled();
    expect(m.resend).toHaveBeenCalledWith(5, { idempotencyKey: "clave-1" });
  });
  it("sin token vigente crea uno con los días de la config", async () => {
    m.token.mockResolvedValue(null);
    m.resend.mockResolvedValue({ queued: true });
    const antes = Date.now();
    expect(await reenviarDescargaDePedido(o, "k")).toEqual({ ok: true, renovado: true });
    const arg = m.create.mock.calls[0]![0];
    expect(arg).toMatchObject({ orderId: 5, albumId: 3 });
    const dias = (arg.expiresAt.getTime() - antes) / (24 * 60 * 60 * 1000);
    expect(dias).toBeGreaterThan(14.99);
    expect(dias).toBeLessThan(15.01);
  });
  it("queued: false → ok: false con el error", async () => {
    m.token.mockResolvedValue({ id: 1 });
    m.resend.mockResolvedValue({ queued: false, error: "Sin token de descarga" });
    expect(await reenviarDescargaDePedido(o, "k")).toEqual({ ok: false, error: "Sin token de descarga" });
  });
  it("excepción → ok: false con el error como texto", async () => {
    const e = new Error("db caída");
    m.token.mockRejectedValue(e);
    expect(await reenviarDescargaDePedido(o, "k")).toEqual({ ok: false, error: "Error: db caída", causa: e });
    expect(m.resend).not.toHaveBeenCalled();
  });
});

describe("albumConOriginales", () => {
  it("sin limpieza o pendiente → tiene originales", () => {
    expect(albumConOriginales({ deletedAt: null, cleanupStatus: "NONE" })).toBe(true);
    expect(albumConOriginales({ deletedAt: null, cleanupStatus: "PENDING" })).toBe(true);
  });
  it("limpieza en curso o hecha → no tiene", () => {
    expect(albumConOriginales({ deletedAt: null, cleanupStatus: "PROCESSING" })).toBe(false);
    expect(albumConOriginales({ deletedAt: null, cleanupStatus: "COMPLETED" })).toBe(false);
    expect(albumConOriginales({ deletedAt: null, cleanupStatus: "COMPLETED_WITH_REFERENCES" })).toBe(false);
  });
  it("álbum borrado → no tiene", () => {
    expect(albumConOriginales({ deletedAt: new Date(), cleanupStatus: "NONE" })).toBe(false);
  });
});
